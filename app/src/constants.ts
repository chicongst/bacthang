// The product name is Vietnamese: it is the brand these groups know it by, in both languages.
export const DEFAULT_BOARD_NAME = "Bảng Xếp Hạng";

// Mirrors WORKSPACE_NAME_MIN and WORKSPACE_NAME_MAX in server/src/domain/rules.ts. The form needs
// them before it can call the API, and the API is not asked for its validation bounds.
export const WORKSPACE_NAME_MIN = 2;
export const WORKSPACE_NAME_MAX = 40;
