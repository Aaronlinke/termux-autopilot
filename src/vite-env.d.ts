/// <reference types="vite/client" />

declare module "*.sh?raw" {
  const content: string;
  export default content;
}
