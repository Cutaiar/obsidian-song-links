declare module "electron"; // We need this so that we can import electron from "electron" rather than require()

// We need this to be able to import SVG files in TS
declare module "*.svg" {
  const content: string;
  export default content;
}
