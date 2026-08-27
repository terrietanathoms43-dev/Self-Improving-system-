import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test:{environment:"jsdom",exclude:["tests/e2e/**","node_modules/**"],coverage:{provider:"v8",reporter:["text","json","html"],thresholds:{lines:80,functions:80,statements:80,branches:75}}},resolve:{alias:{"@":path.resolve(__dirname,"src")}}});
