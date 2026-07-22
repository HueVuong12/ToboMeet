import { getDefaultConfig } from "expo/metro-config";
import { withNativeWind } from "nativewind/metro";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Xác định đường dẫn gốc
const projectRoot = __dirname;
// Lùi 2 cấp từ apps/mobile để ra đến thư mục gốc của dự án (ToboMeet)
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 2. CẤU HÌNH MONOREPO
// Báo cho Metro theo dõi thư mục chứa package shared
config.watchFolders = [workspaceRoot];

// Ưu tiên tìm node_modules trong thư mục mobile, sau đó tìm trong thư mục gốc (root)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Tắt tra cứu phân cấp để tránh lỗi tìm nhầm module
config.resolver.disableHierarchicalLookup = true;

// 3. XUẤT CẤU HÌNH ĐÃ KẾT HỢP NATIVEWIND
export default withNativeWind(config, { input: "./global.css" });
