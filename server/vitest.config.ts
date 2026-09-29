import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Các file test tích hợp dùng chung một database, không được chạy chồng lên nhau.
    fileParallelism: false,
  },
});
