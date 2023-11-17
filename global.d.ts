// We need this to be able to import SVG files in TS
declare module "*.svg" {
  const content: string;
  export default content;
}
