/** Bỏ dấu tiếng Việt và hạ chữ thường, để tìm "quan" ra "Quận". */
export function fold(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}
