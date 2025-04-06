import React, { useState, useEffect } from "react";
import { IconButton } from "./button";
import styles from "./custom-provider.module.scss";
import { useNavigate } from "react-router-dom";
import { Path, StoreKey } from "../constant";
import { safeLocalStorage } from "../utils";
import Locale from "../locales";
import {
  List,
  ListItem,
  Modal,
  PasswordInput,
  Select,
  showToast,
} from "./ui-lib";
import { useAccessStore } from "../store";
import { Model, userCustomProvider } from "../client/api";
// 导入图标
import PlusIcon from "../icons/add.svg";
import EditIcon from "../icons/edit.svg";
import TrashIcon from "../icons/delete.svg";
import CloseIcon from "../icons/close.svg";
import LoadingIcon from "../icons/loading.svg";
import SearchIcon from "../icons/zoom.svg";

// 获取提供商类型标签
const providerTypeLabels: Record<string, string> = {
  openai: "OpenAI",
  siliconflow: "SiliconFlow",
  deepseek: "DeepSeek",
  // azure: 'Azure OpenAI',
  // anthropic: 'Anthropic',
  // custom: '自定义API',
};
// 获取提供商默认的地址
const providerTypeDefaultUrls: Record<string, string> = {
  openai: "https://api.openai.com",
  siliconflow: "https://api.siliconflow.cn",
  deepseek: "https://api.deepseek.com",
};

const KeyItem = ({
  onDelete,
  index,
  apiKey,
  baseUrl,
  type,
}: {
  onDelete: (index: number) => void;
  index: number;
  apiKey: string;
  baseUrl: string;
  type: string;
}) => {
  const accessStore = useAccessStore.getState();
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  const checkBalance = async () => {
    setLoading(true);
    try {
      let result = null;
      if (type === "siliconflow") {
        result = await accessStore.checkSiliconFlowBalance(apiKey, baseUrl);
      } else if (type === "deepseek") {
        result = await accessStore.checkDeepSeekBalance(apiKey, baseUrl);
      } else if (
        type === "openai" &&
        baseUrl !== providerTypeDefaultUrls[type]
      ) {
        result = await accessStore.checkCustomOpenaiBalance(apiKey, baseUrl);
      }
      // 处理 result
      if (result && result.isValid && result.totalBalance) {
        setBalance(`${result.currency} ${result.totalBalance}`);
      } else {
        showToast(result?.error || "查询失败或不支持查询");
      }
    } catch (error) {
      console.error("查询余额出错:", error);
      showToast("查询余额失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.keyItem}>
      <div className={styles.keyContent}>
        <div className={styles.keyText}>{apiKey}</div>
      </div>
      <div className={styles.keyActions}>
        {balance && <div className={styles.balanceDisplay}>{balance}</div>}

        {!loading && !balance ? (
          <IconButton
            icon={<SearchIcon />}
            text="$"
            bordered
            onClick={checkBalance}
            title="查询余额"
          />
        ) : loading ? (
          <div style={{ width: "20px", height: "20px" }}>
            <LoadingIcon />
          </div>
        ) : null}

        <div className={styles.keyDeleteIcon} onClick={() => onDelete(index)}>
          <TrashIcon />
        </div>
      </div>
    </div>
  );
};

// 提供商编辑模态框
function ProviderModal(props: {
  provider: userCustomProvider | null;
  onSave: (provider: userCustomProvider) => void;
  onClose: () => void;
  providers: userCustomProvider[]; // 添加providers参数
  setProviders: React.Dispatch<React.SetStateAction<userCustomProvider[]>>; // 添加setProviders
  saveProvidersToStorage: (providers: userCustomProvider[]) => void; // 添加保存函数
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<
    Omit<userCustomProvider, "id"> & { id?: string }
  >({
    name: "",
    apiKey: "",
    baseUrl: "",
    type: "openai",
    models: [],
    status: "inactive",
  });

  // 模型相关状态
  const [models, setModels] = useState<Model[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelSearchTerm, setModelSearchTerm] = useState("");
  // 模型排序状态
  const [initialSortDone, setInitialSortDone] = useState(false);
  // 模型编辑和json视图
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [editedDisplayName, setEditedDisplayName] = useState("");
  const [isJsonViewMode, setIsJsonViewMode] = useState(false);
  const [displayNameMapText, setDisplayNameMapText] = useState("");
  // API Key 列表视图状态
  const [isKeyListViewMode, setIsKeyListViewMode] = useState(false);
  const [keyList, setKeyList] = useState<string[]>([]);
  const [newKey, setNewKey] = useState("");

  // 当编辑现有提供商时，加载数据
  useEffect(() => {
    if (props.provider) {
      setFormData({
        id: props.provider.id,
        name: props.provider.name,
        apiKey: props.provider.apiKey,
        baseUrl: props.provider.baseUrl,
        type: props.provider.type,
        models: props.provider.models || [],
        status: props.provider.status || "active",
      });

      if (props.provider.models) {
        setModels(props.provider.models);
      }
    } else {
      // 添加新提供商，初始化默认值
      setFormData({
        name: "",
        apiKey: "",
        baseUrl: "",
        type: "openai",
        models: [],
        status: "active",
      });
      setModels([]);
    }
  }, [props.provider]);

  const [rawInput, setRawInput] = useState("");
  const parseRawInput = () => {
    if (!rawInput.trim()) {
      showToast("请输入需要解析的内容");
      return;
    }

    // Initial data to be filled
    let parsedName = "";
    let parsedUrl = "";
    let parsedApiKey = "";

    // Extract name (first line is usually the name)
    const lines = rawInput.split("\n");
    if (lines.length > 0) {
      parsedName = lines[0].trim();
    }

    // Extract URL with regex
    const urlRegex = /(https?:\/\/[^\s]+)/i;
    const urlMatch = rawInput.match(urlRegex);
    if (urlMatch && urlMatch[1]) {
      let url = urlMatch[1].replace(/["'<>()\[\]]+$/, "").trim();

      // Process URL according to the rules
      const urlObj = new URL(url);
      const mainDomain = `${urlObj.protocol}//${urlObj.hostname}`;

      // Check if it ends with 'completions' but is NOT 'v1/chat/completions'
      if (url.endsWith("completions") && !url.endsWith("v1/chat/completions")) {
        // For completions endpoints (not standard OpenAI path), add '#'
        parsedUrl = url + "#";
      } else {
        // For all other cases, use just the main domain
        parsedUrl = mainDomain;
      }
    }
    // Extract API key with regex
    const apiKeyRegex = /(sk-[^\s]+)/i;
    const apiKeyMatch = rawInput.match(apiKeyRegex);
    if (apiKeyMatch && apiKeyMatch[1]) {
      parsedApiKey = apiKeyMatch[1].trim();
    }

    // Update form data
    setFormData((prev) => ({
      ...prev,
      name: parsedName || prev.name,
      baseUrl: parsedUrl || prev.baseUrl,
      apiKey: parsedApiKey || prev.apiKey,
    }));

    // Clear the raw input area
    // setRawInput("");

    // Show success message
    showToast("解析成功");
  };

  // 添加切换供应商状态的函数
  const toggleProviderStatus = (id: string) => {
    if (!id) return; // 如果是新建的，还没有ID，则不执行

    const updatedProviders = props.providers.map((provider) =>
      provider.id === id
        ? {
            ...provider,
            status:
              provider.status === "active"
                ? ("inactive" as const)
                : ("active" as const),
          }
        : provider,
    );

    props.setProviders(updatedProviders);
    props.saveProvidersToStorage(updatedProviders);

    // 同时更新表单数据
    setFormData((prev) => ({
      ...prev,
      status: prev.status === "active" ? "inactive" : "active",
    }));
  };

  const handleChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const saveFirstStep = () => {
    if (!formData.name.trim()) {
      showToast(Locale.CustomProvider.ApiNameRequired);
      return;
    }
    if (!formData.baseUrl.trim()) {
      showToast(Locale.CustomProvider.ApiUrlRequired);
      return;
    }
    if (!formData.apiKey.trim()) {
      showToast(Locale.CustomProvider.ApiKeyRequired);
      return;
    }
    // 保留当前存在的models数据
    const saveData: userCustomProvider = {
      ...formData,
      id: formData.id || `provider-${Date.now()}`, // 确保有ID
      models: props.provider?.models || [], // 保留现有模型
      status: (formData.status as "active" | "inactive") || "active",
    };
    props.onSave(saveData);
  };

  const handleSubmit = () => {
    // 准备保存的数据，包括选中的模型
    const selectedModels = models.filter((model) => model.available);

    const saveData: userCustomProvider = {
      ...formData,
      id: formData.id || `provider-${Date.now()}`, // 确保有ID
      models: selectedModels,
      status: (formData.status as "active" | "inactive") || "active",
    };

    props.onSave(saveData);
  };

  const nextStep = () => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        showToast(Locale.CustomProvider.ApiNameRequired);
        return;
      }
      if (!formData.apiKey.trim()) {
        showToast(Locale.CustomProvider.ApiKeyRequired);
        return;
      }
    }
    if (!formData.baseUrl.trim()) {
      formData.baseUrl = providerTypeDefaultUrls[formData.type];
      console.log(formData);
    }
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1);
      setInitialSortDone(false);
      fetchModels();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setIsJsonViewMode(false);
    }
  };

  // 拉取模型列表
  const fetchModels = async () => {
    if (!formData.apiKey || !formData.baseUrl) {
      showToast(Locale.CustomProvider.ApiConfigRequired);
      return;
    }

    setIsLoadingModels(true);

    try {
      const accessStore = useAccessStore.getState();
      // 调用真实的API获取模型列表
      const api_key = formData.apiKey.split(",")[0].trim();
      const modelsStr = await accessStore.fetchAvailableModels(
        formData.baseUrl,
        api_key,
      );

      // 创建一个现有模型的映射，用于保留displayName
      const existingModelsMap = new Map();
      models.forEach((model) => {
        // 只保存有自定义displayName的模型
        if (model.displayName) {
          existingModelsMap.set(model.name, model.displayName);
        }
      });

      // 解析API返回的模型数据
      let fetchedModels: Model[] = [];
      if (modelsStr) {
        const modelNames = modelsStr
          .replace("-all,", "")
          .split(",")
          .filter(Boolean);

        fetchedModels = modelNames.map((modelName) => {
          const [id, provider] = modelName.split("@");
          return {
            name: id,
            displayName: existingModelsMap.get(id),
            available: false,
            isDefault: false,
            provider: {
              id: provider || id,
              providerName: provider || id,
              providerType: provider || id,
            },
          };
        });
      }

      // 优先使用API返回的数据，如果为空则尝试本地存储
      if (fetchedModels.length === 0 && formData.models?.length) {
        fetchedModels = formData.models; // 使用本地存储的模型数据
      }

      // 保留已选状态
      const selectedModelNames = (formData.models || [])
        .filter((m) => m.available)
        .map((m) => m.name);

      // 构建displayName映射
      const displayNameMap = new Map();
      formData.models?.forEach((model) => {
        if (model.displayName) {
          displayNameMap.set(model.name, model.displayName);
        }
      });

      let modelsToSet = fetchedModels.map((model) => ({
        ...model,
        // 保留显示名称的优先级:
        // 1. 从API获取的模型已有displayName
        // 2. 从现有formData.models中获取displayName
        // 3. 不设置displayName
        displayName: model.displayName || displayNameMap.get(model.name),
        available: selectedModelNames.includes(model.name),
      }));
      // 如果是在 step 2 且还没有进行过初始排序，则进行一次排序
      if (!initialSortDone) {
        modelsToSet = modelsToSet.sort((a, b) => {
          if (a.available && !b.available) return -1;
          if (!a.available && b.available) return 1;
          return a.name.localeCompare(b.name);
        });
        setInitialSortDone(true);
      }
      setModels(modelsToSet);
    } catch (error) {
      console.error("获取模型列表失败:", error);
      if (formData.models?.length) {
        if (currentStep === 2 && !initialSortDone) {
          const sortedModels = [...formData.models].sort((a, b) => {
            if (a.available && !b.available) return -1;
            if (!a.available && b.available) return 1;
            return a.name.localeCompare(b.name);
          });
          setModels(sortedModels);
          setInitialSortDone(true);
        } else {
          setModels(formData.models);
        }
      } else {
        showToast(`获取模型列表失败: ${error}`);
      }
    } finally {
      setIsLoadingModels(false);
    }
  };
  // 添加模型
  const AddModels = async () => {
    const searchModel = modelSearchTerm.trim();
    if (!searchModel) {
      showToast(Locale.CustomProvider.ModelNameRequired);
      return;
    }

    // 检查是否已存在同名模型
    if (models.some((m) => m.name === searchModel)) {
      showToast(Locale.CustomProvider.ModelExists);
      return;
    }

    // 支持逗号和换行符分割多个模型名称
    const modelNames = searchModel
      .split(/[,，\n]/)
      .map((name) => name.trim())
      .filter(Boolean);

    // 处理每个模型名称
    const newModels: Model[] = [];
    const existingNames = new Set(models.map((m) => m.name));

    for (const name of modelNames) {
      if (existingNames.has(name)) {
        continue; // 跳过已存在的模型
      }

      // 创建新模型
      newModels.push({
        name: name,
        available: true,
        isDefault: false,
        provider: {
          id: name,
          providerName: name,
          providerType: name,
        },
      });

      existingNames.add(name);
    }
    if (newModels.length > 0) {
      // 更新模型列表并清空搜索
      setModels([...models, ...newModels]);
      setModelSearchTerm("");
    } else if (modelNames.length > 0) {
      showToast(Locale.CustomProvider.ModelExists);
    }
  };

  // 添加键盘事件处理
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      AddModels();
    }
  };
  // 编辑模型显示名称的处理函数
  const handleEditDisplayName = (model: Model, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingModel(model);
    setEditedDisplayName(model.displayName || model.name);
  };
  // 保存显示名称
  const saveDisplayName = () => {
    if (!editingModel) return;

    setModels(
      models.map((model) =>
        model.name === editingModel.name
          ? { ...model, displayName: editedDisplayName.trim() || model.name }
          : model,
      ),
    );

    setEditingModel(null);
  };
  // 生成显示名称映射JSON字符串的函数
  const generateDisplayNameMapView = () => {
    const displayNameMap: Record<string, string> = {};
    models.forEach((model) => {
      if (model.displayName && model.displayName !== model.name) {
        displayNameMap[model.name] = model.displayName;
      }
    });

    return JSON.stringify(displayNameMap, null, 2);
  };
  // 解析并应用显示名称映射的函数
  const applyDisplayNameMap = () => {
    try {
      const json = JSON.parse(displayNameMapText);

      // 验证是否为有效的映射格式
      if (typeof json !== "object" || json === null) {
        throw new Error(Locale.CustomProvider.EditModel.ErrorJson);
      }

      // 应用映射到模型
      setModels(
        models.map((model) => ({
          ...model,
          displayName: json[model.name] || model.displayName || model.name,
        })),
      );

      showToast(Locale.CustomProvider.EditModel.SuccessJson);
      setIsJsonViewMode(false); // 应用后切回正常视图
    } catch (error) {
      console.error("解析JSON失败:", error);
      showToast(Locale.CustomProvider.EditModel.ErrorJson);
    }
  };
  // 在JSON视图模式切换时更新文本内容
  useEffect(() => {
    if (isJsonViewMode) {
      setDisplayNameMapText(generateDisplayNameMapView());
    }
  }, [isJsonViewMode]);

  // 切换模型选中状态
  const toggleModelSelection = (modelName: string) => {
    setModels(
      models.map((model) =>
        model.name === modelName
          ? {
              ...model,
              available:
                model.available === undefined ? true : !model.available,
            }
          : model,
      ),
    );
  };

  useEffect(() => {
    if (props.provider) {
      setFormData({
        id: props.provider.id,
        name: props.provider.name,
        apiKey: props.provider.apiKey,
        baseUrl: props.provider.baseUrl,
        type: props.provider.type,
        models: props.provider.models || [],
        status: props.provider.status || "active",
      });
      if (props.provider.models) {
        setModels(props.provider.models);
      }

      // Initialize key list from apiKey string
      if (props.provider.apiKey) {
        setKeyList(
          props.provider.apiKey
            .split(",")
            .map((key) => key.trim())
            .filter(Boolean),
        );
      }
    } else {
      // Reset for new provider
      setFormData({
        name: "",
        apiKey: "",
        baseUrl: "",
        type: "openai",
        models: [],
        status: "active",
      });
      setModels([]);
      setKeyList([]);
    }
  }, [props.provider]);

  // Update apiKey string when keyList changes
  useEffect(() => {
    const apiKeyString = keyList.join(",");
    setFormData((prev) => ({ ...prev, apiKey: apiKeyString }));
  }, [keyList]);

  // Function to add a new key to the list
  const addKeyToList = () => {
    if (!newKey.trim()) {
      showToast("API Key cannot be empty");
      return;
    }

    // Check for duplicates
    if (keyList.includes(newKey.trim())) {
      showToast("This API Key already exists");
      return;
    }

    setKeyList([...keyList, newKey.trim()]);
    setNewKey("");
  };

  // Function to remove a key from the list
  const removeKeyFromList = (index: number) => {
    const updatedKeys = [...keyList];
    updatedKeys.splice(index, 1);
    setKeyList(updatedKeys);
  };

  // Function to handle key press in key input field
  const handleKeyInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyToList();
    }
  };
  const renderApiKeysSection = () => {
    if (isKeyListViewMode) {
      return (
        <div className={styles.keyListContainer}>
          <div className={styles.keyInputContainer}>
            <input
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder={Locale.CustomProvider.ApiKeyPlaceholder}
              className={styles.keyInput}
              onKeyDown={handleKeyInputKeyDown}
            />
            <IconButton
              text="Add Key"
              onClick={addKeyToList}
              type="primary"
              bordered
            />
          </div>

          <div className={styles.keyListScroll}>
            {keyList.length === 0 ? (
              <div className={styles.emptyKeys}>
                No API keys added. Add your first key above.
              </div>
            ) : (
              <div className={styles.keyList}>
                {keyList.map((key, index) => (
                  <KeyItem
                    key={index}
                    onDelete={removeKeyFromList}
                    index={index}
                    apiKey={key}
                    baseUrl={formData.baseUrl}
                    type={formData.type}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <PasswordInput
          style={{ width: "340px" }}
          value={formData.apiKey}
          type="text"
          placeholder={Locale.CustomProvider.ApiKeyPlaceholder}
          onChange={(e) => handleChange("apiKey", e.currentTarget.value)}
          required
        />
      );
    }
  };

  // 模型网格排序和过滤
  const filteredModels = models
    .filter((model) => {
      // 过滤无效模型
      const hasValidName =
        typeof model.name === "string" && model.name.trim() !== "";
      if (!hasValidName) return false;

      // 如果没有搜索关键词，直接通过
      if (!modelSearchTerm) return true;

      const lowerName = model.name.toLowerCase();
      const lowerSearchTerm = modelSearchTerm.toLowerCase();

      if (lowerName.includes(lowerSearchTerm)) {
        return true;
      }
      try {
        const regex = new RegExp(modelSearchTerm, "i");
        return regex.test(model.name);
      } catch (e) {
        console.error(`Invalid regex: ${modelSearchTerm}`, e);
        return false;
      }
    })
    .sort((a, b) => {
      // 在 step 2 中且已完成初始排序，不再排序
      if (currentStep === 2 && initialSortDone) {
        return 0;
      }

      if (a.available && !b.available) return -1;
      if (!a.available && b.available) return 1;
      return a.name.localeCompare(b.name);
    });

  // 添加模型测试状态管理
  const [modelTestStatus, setModelTestStatus] = useState<
    Record<
      string,
      {
        status: "idle" | "testing" | "success" | "error";
        result?: string;
        time?: number;
      }
    >
  >({});
  // 测试模型可用性
  const testModelAvailability = async (model: Model, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡，避免触发选择模型
    const modelName = model.name;

    // 更新状态为测试中
    setModelTestStatus((prev) => ({
      ...prev,
      [modelName]: { status: "testing" },
    }));
    try {
      const startTime = Date.now();

      // 使用第一个API Key进行测试
      const apiKey = formData.apiKey.split(",")[0].trim();

      // 准备测试请求
      const testMessage = {
        role: "user",
        content: "Hello. Please respond with 'OK'.",
      };
      let completionPath = "/v1/chat/completions";
      if (formData.type === "deepseek") {
        completionPath = "/chat/completions";
      }
      // 发送非流式请求
      const response = await fetchWithTimeout(
        `${formData.baseUrl}${completionPath}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [testMessage],
            max_tokens: 20,
            stream: false,
          }),
        },
        10000, // 设置超时时间为10秒
      );

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.ok) {
        // 测试成功
        setModelTestStatus((prev) => ({
          ...prev,
          [modelName]: {
            status: "success",
            result: `${responseTime}ms`,
            time: responseTime,
          },
        }));
      } else {
        // API返回错误
        const errorData = await response
          .json()
          .catch(() => ({ error: { message: "未知错误", code: "unknown" } }));
        const errorCode =
          errorData.error?.code ||
          errorData.error?.type ||
          `${response.status}`;
        const errorMessage =
          errorData.error?.message || `错误 ${response.status}`;

        showToast(`模型 ${modelName} 测试失败: ${errorMessage}`);

        setModelTestStatus((prev) => ({
          ...prev,
          [modelName]: {
            status: "error",
            result: errorCode,
          },
        }));
      }
    } catch (error) {
      // 请求异常
      console.error("测试模型失败:", error);
      let errorMsg = "请求失败";
      let errorCode = "Error";

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          errorMsg = "请求超时";
          errorCode = "TIMEOUT";
        } else if (error.message.includes("timeout")) {
          errorMsg = "请求超时";
          errorCode = "TIMEOUT";
        } else {
          errorMsg = error.message;
          errorCode = error.name || "ERROR";
        }
      }
      showToast(`模型 ${modelName} 测试失败: ${errorMsg}`);

      setModelTestStatus((prev) => ({
        ...prev,
        [modelName]: {
          status: "error",
          result: errorCode,
        },
      }));
    }
  };
  // 带超时的请求函数
  const fetchWithTimeout = async (
    url: string,
    options: RequestInit,
    timeout = 10000,
  ) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      throw error;
    }
  };

  return (
    <div className="modal-mask">
      <Modal
        title={
          props.provider
            ? Locale.CustomProvider.Edit
            : Locale.CustomProvider.AddProvider
        }
        onClose={props.onClose}
        actions={[
          currentStep > 1 && !isJsonViewMode && (
            <IconButton
              key="prev"
              text={Locale.CustomProvider.Previous}
              onClick={prevStep}
              bordered
            />
          ),
          currentStep < 2 ? (
            <IconButton
              key="next"
              text={Locale.CustomProvider.Next}
              onClick={nextStep}
              bordered
            />
          ) : null,
          currentStep === 1 && (
            <IconButton
              key="keyViewToggle"
              text={
                isKeyListViewMode
                  ? Locale.CustomProvider.NormalView
                  : Locale.CustomProvider.KeyListView
              }
              onClick={() => setIsKeyListViewMode(!isKeyListViewMode)}
              bordered
            />
          ),
          currentStep === 2 && (
            <IconButton
              key="viewToggle"
              text={
                isJsonViewMode
                  ? Locale.CustomProvider.EditModel.CardView
                  : Locale.CustomProvider.EditModel.JsonView
              }
              onClick={() => setIsJsonViewMode(!isJsonViewMode)}
              bordered
            />
          ),

          // 在JSON视图模式下显示应用按钮
          currentStep === 2 && isJsonViewMode && (
            <IconButton
              key="applyJson"
              text={Locale.CustomProvider.EditModel.ApplyJson}
              // type="primary"
              onClick={applyDisplayNameMap}
              bordered
            />
          ),

          // 保存按钮 - 在JSON视图模式下不显示
          !isJsonViewMode && (
            <IconButton
              key="save"
              text={
                props.provider
                  ? Locale.CustomProvider.SaveChanges
                  : Locale.CustomProvider.AddProvider
              }
              // type="primary"
              onClick={handleSubmit}
              bordered
            />
          ),
        ].filter(Boolean)}
      >
        <div className={styles.stepsContainer}>
          <div className={styles.steps}>
            <div
              className={`${styles.stepItem} ${
                currentStep === 1 ? styles.active : ""
              }`}
              onClick={() => setCurrentStep(1)}
            >
              <span className={styles.stepNumber}>1</span>
              <span className={styles.stepText}>
                {Locale.CustomProvider.BasicInfo}
              </span>
            </div>

            <div
              className={`${styles.stepItem} ${
                currentStep === 2 ? styles.active : ""
              } ${currentStep < 2 ? styles.disabled : ""}`}
              onClick={() => currentStep >= 2 && setCurrentStep(2)}
            >
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepText}>
                {Locale.CustomProvider.ModelConfig}
              </span>
            </div>
          </div>
        </div>

        {currentStep === 1 && (
          <List>
            <>
              <ListItem
                title={Locale.CustomProvider.Type}
                subTitle={Locale.CustomProvider.TypeSubtitle}
              >
                <Select
                  value={formData.type}
                  onChange={(e) => handleChange("type", e.target.value)}
                >
                  <option value="openai">OpenAI</option>
                  <option value="siliconflow">SiliconFlow</option>
                  <option value="deepseek">DeepSeek</option>
                </Select>
              </ListItem>
              <ListItem
                title={Locale.CustomProvider.Name}
                subTitle={Locale.CustomProvider.NameSubtitle}
              >
                <input
                  style={{ width: "300px" }}
                  type="text"
                  value={formData.name}
                  placeholder={Locale.CustomProvider.NamePlaceholder}
                  onChange={(e) => handleChange("name", e.currentTarget.value)}
                  required
                />
              </ListItem>
              <ListItem
                title={Locale.CustomProvider.CustomAPIService}
                subTitle={Locale.CustomProvider.ApiUrlSubtitle}
              >
                <input
                  style={{ width: "300px" }}
                  type="text"
                  value={formData.baseUrl}
                  placeholder={providerTypeDefaultUrls[formData.type]}
                  onChange={(e) =>
                    handleChange("baseUrl", e.currentTarget.value)
                  }
                  required
                />
              </ListItem>

              <ListItem
                title="API Key"
                subTitle={Locale.CustomProvider.ApiKeySubtitle}
              >
                {renderApiKeysSection()}
              </ListItem>
            </>
            <div className={styles.intelligentParsingContainer}>
              <textarea
                placeholder={Locale.CustomProvider.ParsingPlaceholder}
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                className={styles.parsingTextarea}
              />
              <div className={styles.parsingButtonContainer}>
                <IconButton
                  text={Locale.CustomProvider.IntelligentParsing}
                  onClick={parseRawInput}
                  type="primary"
                />
              </div>
            </div>
          </List>
        )}
        {currentStep === 2 && (
          <div className={styles.modelPullContainer}>
            {/* 搜索和操作区域 */}
            <div className={styles.modelFilter}>
              <input
                type="text"
                value={modelSearchTerm}
                placeholder={Locale.CustomProvider.SearchModel}
                className={styles.searchBar}
                onChange={(e) => setModelSearchTerm(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <div className={styles.actions}>
                <IconButton
                  text={Locale.Select.All}
                  bordered
                  onClick={() => {
                    if (modelSearchTerm) {
                      // 有搜索关键词时只选择筛选后的模型
                      setModels(
                        models.map((model) => ({
                          ...model,
                          available: filteredModels.some(
                            (m) => m.name === model.name,
                          ),
                        })),
                      );
                    } else {
                      // 没有搜索关键词时选择所有模型
                      setModels(
                        models.map((model) => ({ ...model, available: true })),
                      );
                    }
                  }}
                />
                <IconButton
                  text={Locale.Select.Clear}
                  bordered
                  onClick={() => {
                    if (modelSearchTerm) {
                      // 有搜索关键词时只清除筛选后的模型的选中状态
                      const filteredModelNames = new Set(
                        filteredModels.map((m) => m.name),
                      );
                      setModels(
                        models.map((model) => ({
                          ...model,
                          available:
                            model.available &&
                            !filteredModelNames.has(model.name),
                        })),
                      );
                      setModelSearchTerm("");
                    } else {
                      // 没有搜索关键词时清除所有模型的选中状态
                      setModels(
                        models.map((model) => ({ ...model, available: false })),
                      );
                    }
                  }}
                />
                <IconButton
                  text={Locale.CustomProvider.RefreshModels}
                  bordered
                  onClick={fetchModels}
                />
                <IconButton
                  text={Locale.CustomProvider.AddModels}
                  bordered
                  onClick={AddModels}
                />
              </div>
            </div>

            {/* 模型列表容器 */}
            <div className={styles.modelListContainer}>
              {/* 加载状态 */}
              {isLoadingModels ? (
                <div className={styles.loadingModels}>
                  <LoadingIcon />
                  <span>{Locale.CustomProvider.LoadingModels}</span>
                </div>
              ) : isJsonViewMode ? (
                // JSON编辑视图 - 移除内部应用按钮
                <div style={{ padding: "10px" }}>
                  <div
                    style={{
                      marginBottom: "10px",
                      fontSize: "14px",
                      color: "#374151",
                    }}
                  >
                    {Locale.CustomProvider.EditModel.EditJson}
                  </div>
                  <textarea
                    value={displayNameMapText}
                    onChange={(e) => setDisplayNameMapText(e.target.value)}
                    style={{
                      width: "100%",
                      height: "250px",
                      padding: "12px",
                      borderRadius: "6px",
                      border: "1px solid #e5e7eb",
                      fontFamily: "monospace",
                      fontSize: "14px",
                      lineHeight: "1.5",
                      resize: "vertical",
                    }}
                  />
                </div>
              ) : filteredModels.length > 0 ? (
                /* 模型网格 */
                <div className={styles.modelGrid}>
                  {filteredModels.map((model) => (
                    <div
                      key={model.name}
                      className={`${styles.modelItem} ${
                        model.available ? styles.selected : ""
                      }`}
                      onClick={() => toggleModelSelection(model.name)}
                    >
                      <div className={styles.modelContent}>
                        <div
                          className={styles.modelName}
                          title={model.name} // 只添加title属性
                        >
                          {model.displayName || model.name}
                        </div>
                      </div>
                      <div className={styles.modelFooter}>
                        <div
                          className={`${styles.modelTestIcon} ${
                            modelTestStatus[model.name]?.status === "testing"
                              ? styles.testing
                              : modelTestStatus[model.name]?.status ===
                                "success"
                              ? styles.success
                              : modelTestStatus[model.name]?.status === "error"
                              ? styles.error
                              : ""
                          }`}
                          onClick={(e) => testModelAvailability(model, e)}
                          title={
                            modelTestStatus[model.name]?.status === "success"
                              ? `响应时间: ${modelTestStatus[model.name]
                                  ?.result}`
                              : modelTestStatus[model.name]?.status === "error"
                              ? `错误: ${modelTestStatus[model.name]?.result}`
                              : "测试模型可用性"
                          }
                        >
                          {modelTestStatus[model.name]?.status === "testing" ? (
                            <LoadingIcon />
                          ) : modelTestStatus[model.name]?.status ===
                            "success" ? (
                            <span className={styles.testResult}>
                              {modelTestStatus[model.name]?.result}
                            </span>
                          ) : modelTestStatus[model.name]?.status ===
                            "error" ? (
                            <span className={styles.testResult}>
                              {modelTestStatus[model.name]?.result}
                            </span>
                          ) : (
                            <span className={styles.testIcon}>Test</span>
                          )}
                        </div>
                        {model.available && (
                          <div
                            className={styles.modelEditButton}
                            onClick={(e) => handleEditDisplayName(model, e)}
                          >
                            Edit
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyModels}>
                  <p>{Locale.CustomProvider.NoModelsFound}</p>
                  <p>{Locale.CustomProvider.NoModelsFoundHint}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
      {editingModel && (
        <div className="modal-mask" style={{ zIndex: 2000 }}>
          <div className={styles.editNameModal}>
            <div className={styles.editNameHeader}>
              <h3>{Locale.CustomProvider.EditModel.EditDisplayName}</h3>
              <span
                className={styles.closeButton}
                onClick={() => setEditingModel(null)}
              >
                <CloseIcon />
              </span>
            </div>
            <div className={styles.editNameContent}>
              <div className={styles.editNameRow}>
                <label>{Locale.CustomProvider.EditModel.ModelID}</label>
                <div className={styles.modelIdText}>{editingModel.name}</div>
              </div>
              <div className={styles.editNameRow}>
                <label>{Locale.CustomProvider.EditModel.DisplayName}</label>
                <input
                  type="text"
                  value={editedDisplayName}
                  onChange={(e) => setEditedDisplayName(e.target.value)}
                  placeholder={editingModel.name}
                  className={styles.displayNameInput}
                />
              </div>
            </div>
            <div className={styles.editNameFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => setEditingModel(null)}
              >
                {Locale.CustomProvider.EditModel.Cancel}
              </button>
              <button className={styles.saveButton} onClick={saveDisplayName}>
                {Locale.CustomProvider.EditModel.Save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomProvider() {
  const [providers, setProviders] = useState<userCustomProvider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProvider, setCurrentProvider] =
    useState<userCustomProvider | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // 在 CustomProvider 函数中添加状态
  const [providerBalances, setProviderBalances] = useState<
    Record<string, string>
  >({});
  // 已有的 isSumming 状态可以改为记录每个提供商的加载状态
  const [loadingBalances, setLoadingBalances] = useState<
    Record<string, boolean>
  >({});

  const navigate = useNavigate();

  // 从本地存储加载数据
  useEffect(() => {
    const loadProviders = async () => {
      setIsLoading(true);
      // 从 localStorage 获取数据
      const storedProviders = safeLocalStorage().getItem(
        StoreKey.CustomProvider,
      );

      if (storedProviders) {
        try {
          setProviders(JSON.parse(storedProviders));
        } catch (e) {
          console.error("Failed to parse stored providers:", e);
          setProviders([]);
        }
      } else {
        setProviders([]);
      }

      setIsLoading(false);
    };

    loadProviders();
  }, []);
  // 保存提供商到本地存储
  const saveProvidersToStorage = (updatedProviders: userCustomProvider[]) => {
    try {
      const jsonString = JSON.stringify(updatedProviders);
      safeLocalStorage().setItem(StoreKey.CustomProvider, jsonString);
    } catch (error) {
      console.error("保存到localStorage失败:", error);
    }
  };

  // 过滤提供商
  const filteredProviders = providers.filter(
    (provider) =>
      provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      provider.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // 更新添加提供商函数
  const handleAddProvider = () => {
    setCurrentProvider(null); // 设置为 null 表示添加新提供商
    setIsModalOpen(true); // 打开模态框
  };

  // 打开编辑提供商模态框
  const handleEditProvider = (provider: userCustomProvider) => {
    setCurrentProvider(provider);
    setIsModalOpen(true);
  };

  // 删除提供商
  const handleDeleteProvider = (id: string) => {
    if (window.confirm(Locale.CustomProvider.ConfirmDeleteProvider)) {
      const updatedProviders = providers.filter(
        (provider) => provider.id !== id,
      );
      setProviders(updatedProviders);
      // 保存到本地存储
      saveProvidersToStorage(updatedProviders);
    }
  };

  // 更新保存提供商函数
  const handleSaveProvider = (provider: userCustomProvider) => {
    let updatedProviders;

    if (currentProvider) {
      // 更新现有提供商
      updatedProviders = providers.map((p) =>
        p.id === provider.id ? provider : p,
      );
    } else {
      // 添加新提供商
      const newProvider = {
        ...provider,
        id: provider.id || `provider-${Date.now()}`, // 确保有ID
      };
      updatedProviders = [...providers, newProvider];
    }

    // 更新状态
    setProviders(updatedProviders);

    // 保存到本地存储
    try {
      saveProvidersToStorage(updatedProviders);
    } catch (error) {
      console.error("保存到本地存储失败:", error);
    }

    // // 关闭模态框
    // setIsModalOpen(false);

    // 显示成功消息
    showToast(
      currentProvider
        ? Locale.CustomProvider.ProviderUpdated
        : Locale.CustomProvider.ProviderAdded,
    );
  };

  // 获取模型数量展示文本
  const getModelCountText = (provider: userCustomProvider) => {
    const count = provider.models?.filter((m) => m.available).length || 0;
    return `${count} 个模型`;
  };
  const getKeyCountText = (provider: userCustomProvider) => {
    const count = provider.apiKey.split(",").filter((k) => k.trim()).length;
    return `key: ${count}`;
  };

  // 新增的统计余额函数
  const handleSumBalances = async (provider: userCustomProvider) => {
    const accessStore = useAccessStore.getState();
    const { id, apiKey, baseUrl, type } = provider;

    const keys = apiKey
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (keys.length === 0) {
      showToast("没有可用的 API Key 来统计余额。");
      return;
    }

    if (providerBalances[id]) {
      setProviderBalances((prev) => {
        const newBalances = { ...prev };
        delete newBalances[id];
        return newBalances;
      });
      return;
    }

    let totalBalance = 0;
    let currency = "";

    // 设置当前提供商的加载状态
    setLoadingBalances((prev) => ({ ...prev, [id]: true }));

    try {
      // 使用 Promise.all 来并行获取所有 key 的余额
      const balancePromises = keys.map(async (key) => {
        try {
          let result = null;
          if (type === "siliconflow") {
            result = await accessStore.checkSiliconFlowBalance(key, baseUrl);
          } else if (type === "deepseek") {
            result = await accessStore.checkDeepSeekBalance(key, baseUrl);
          } else if (
            type === "openai" &&
            baseUrl !== providerTypeDefaultUrls[type]
          ) {
            result = await accessStore.checkCustomOpenaiBalance(key, baseUrl);
          }

          if (result && result.isValid && result.totalBalance) {
            if (!currency && result.currency) {
              currency = result.currency;
            }
            return parseFloat(result.totalBalance);
          } else {
            throw new Error(result?.error || "查询失败或不支持查询");
          }
        } catch (error) {
          console.error(`API Key ${key} 余额查询失败:`, error);
          return 0;
        }
      });

      const balances = await Promise.all(balancePromises);
      totalBalance = balances.reduce((acc, curr) => acc + curr, 0);

      // 更新余额状态
      setProviderBalances((prev) => ({
        ...prev,
        [id]: `${currency} ${totalBalance.toFixed(2)}`,
      }));

      showToast(`总余额: ${currency} ${totalBalance.toFixed(2)}`);
    } catch (error) {
      console.error("统计余额时发生错误:", error);
      showToast("统计余额失败，请稍后再试。");
    } finally {
      setLoadingBalances((prev) => ({ ...prev, [id]: false }));
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div>
            <h1>{Locale.CustomProvider.Title}</h1>
            <div className={styles.providerCount}>
              {Locale.CustomProvider.Count.replace(
                "{count}",
                providers.length.toString(),
              )}
            </div>
          </div>
        </div>
        <div className={styles.actions}>
          <IconButton
            icon={<PlusIcon />}
            text={Locale.CustomProvider.AddButton}
            bordered
            onClick={handleAddProvider}
          />
          <IconButton
            icon={<CloseIcon />}
            bordered
            onClick={() => navigate(Path.Settings)}
            title={Locale.CustomProvider.Return}
          />
        </div>
      </div>
      <div className={styles.searchContainer}>
        <input
          type="text"
          placeholder={Locale.CustomProvider.SearchPlaceholder}
          className={styles.searchInput}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <span
            className={styles.clearButton}
            onClick={() => setSearchTerm("")}
          >
            <CloseIcon />
          </span>
        )}
      </div>
      <div className={`${styles.providerList} ${styles.fadeIn}`}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <div>{Locale.CustomProvider.Loading}</div>
          </div>
        ) : filteredProviders.length > 0 ? (
          filteredProviders.map((provider) => (
            <div key={provider.id} className={styles.providerItem}>
              <div className={styles.providerInfo}>
                <div>
                  <div className={styles.providerName}>{provider.name}</div>
                  <div className={styles.providerMeta}>
                    <span
                      className={styles.metaItem}
                      style={{ backgroundColor: "#DAF1F4", color: "#004D5B" }}
                    >
                      {providerTypeLabels[provider.type]}
                    </span>
                    <span
                      className={styles.metaItem}
                      style={{ backgroundColor: "#D9E8FE", color: "#003D8F" }}
                    >
                      {getModelCountText(provider)}
                    </span>
                    <span
                      className={`${styles.metaItem} ${styles.keyCountItem}`}
                      style={{ backgroundColor: "#FFEDD5", color: "#C2410C" }}
                    >
                      {getKeyCountText(provider)}
                    </span>
                    {provider.status && (
                      <span
                        className={styles.metaItem}
                        style={{
                          backgroundColor:
                            provider.status === "active"
                              ? "#d1fae5"
                              : "#fee2e2",
                          color:
                            provider.status === "active"
                              ? "#059669"
                              : "#dc2626",
                        }}
                      >
                        {provider.status === "active"
                          ? Locale.CustomProvider.Status.Enabled
                          : Locale.CustomProvider.Status.Disabled}
                      </span>
                    )}
                    {provider.baseUrl && (
                      <span
                        className={styles.metaItem}
                        style={{ backgroundColor: "#F0E6FF", color: "#5B21B6" }}
                      >
                        {provider.baseUrl}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.providerActions}>
                <div className={styles.statusToggleContainer}>
                  <div
                    className={`${styles.toggleSwitch} ${
                      provider.status === "active" ? styles.active : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      const newStatus: "active" | "inactive" =
                        provider.status === "active" ? "inactive" : "active";
                      const updatedProviders = providers.map((p) =>
                        p.id === provider.id ? { ...p, status: newStatus } : p,
                      );
                      setProviders(updatedProviders);
                      saveProvidersToStorage(updatedProviders);
                      showToast(
                        newStatus === "active"
                          ? Locale.CustomProvider.ProviderEnabled
                          : Locale.CustomProvider.ProviderDisabled,
                      );
                    }}
                    title={
                      provider.status === "active"
                        ? Locale.CustomProvider.ToggleDisable
                        : Locale.CustomProvider.ToggleEnable
                    }
                  >
                    <div className={styles.toggleSlider}></div>
                  </div>
                </div>
                <IconButton
                  icon={
                    loadingBalances[provider.id] ? (
                      <LoadingIcon />
                    ) : (
                      <SearchIcon />
                    )
                  }
                  text={providerBalances[provider.id] || "查询余额"}
                  onClick={() => handleSumBalances(provider)}
                  title={
                    providerBalances[provider.id]
                      ? "点击清除"
                      : "查询所有密钥余额"
                  }
                  bordered
                  className={
                    providerBalances[provider.id] ? styles.balanceButton : ""
                  }
                  disabled={loadingBalances[provider.id]}
                />
                <IconButton
                  icon={<EditIcon />}
                  onClick={() => handleEditProvider(provider)}
                  title={Locale.CustomProvider.Edit}
                  bordered
                />
                <IconButton
                  icon={<TrashIcon />}
                  onClick={() => handleDeleteProvider(provider.id)}
                  title={Locale.CustomProvider.Delete}
                  bordered
                />
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyTitle}>
              {searchTerm
                ? Locale.CustomProvider.NoProviders
                : Locale.CustomProvider.EmptyTitle}
            </div>
            <div className={styles.emptyDescription}>
              {searchTerm
                ? Locale.CustomProvider.EmptySearchDescription
                : Locale.CustomProvider.EmptyDescription}
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <ProviderModal
          provider={currentProvider}
          onSave={handleSaveProvider}
          onClose={() => setIsModalOpen(false)}
          providers={providers}
          setProviders={setProviders}
          saveProvidersToStorage={saveProvidersToStorage}
        />
      )}
    </div>
  );
}
