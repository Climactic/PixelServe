import { describe, expect, test } from "bun:test";
import {
  buildTemplateFromConfig,
  type CustomTemplateConfig,
  parseInlineTemplateConfig,
  validateTemplateConfig,
} from "../../src/services/custom-templates";
import type { OGParams } from "../../src/types";

describe("Custom Templates", () => {
  describe("buildTemplateFromConfig", () => {
    const basicConfig: CustomTemplateConfig = {
      name: "test",
      description: "Test template",
      layout: {
        backgroundColor: "#{{bg}}",
        padding: 60,
        direction: "column",
        align: "center",
        justify: "center",
        elements: [
          {
            type: "text",
            content: "{{title}}",
            fontSize: 48,
            fontWeight: 700,
            color: "#ffffff",
          },
        ],
      },
    };

    test("builds basic template with title", () => {
      const params: OGParams = { title: "Hello World" };
      const result = buildTemplateFromConfig(basicConfig, params);

      expect(result.type).toBe("div");
      expect(result.props.style).toBeDefined();
      expect((result.props.style as Record<string, unknown>).width).toBe(
        "100%",
      );
      expect((result.props.style as Record<string, unknown>).height).toBe(
        "100%",
      );
    });

    test("replaces {{title}} variable", () => {
      const params: OGParams = { title: "My Title" };
      const result = buildTemplateFromConfig(basicConfig, params);

      // Find the text element in children
      const children = result.props.children as Array<{
        props?: { children?: unknown[] };
      }>;
      const textEl = children.find(
        (c) => c.props?.children && c.props.children[0] === "My Title",
      );
      expect(textEl).toBeDefined();
    });

    test("uses default title when not provided", () => {
      const params: OGParams = {};
      const result = buildTemplateFromConfig(basicConfig, params);

      const children = result.props.children as Array<{
        props?: { children?: unknown[] };
      }>;
      const textEl = children.find(
        (c) => c.props?.children && c.props.children[0] === "Untitled",
      );
      expect(textEl).toBeDefined();
    });

    test("replaces {{bg}} variable in background color", () => {
      const params: OGParams = { bg: "ff0000" };
      const result = buildTemplateFromConfig(basicConfig, params);

      const style = result.props.style as Record<string, unknown>;
      expect(style.backgroundColor).toBe("#ff0000");
    });

    test("uses default background when not provided", () => {
      const params: OGParams = {};
      const result = buildTemplateFromConfig(basicConfig, params);

      const style = result.props.style as Record<string, unknown>;
      expect(style.backgroundColor).toBe("#1a1a2e");
    });

    test("applies direction layout (column)", () => {
      const params: OGParams = { title: "Test" };
      const result = buildTemplateFromConfig(basicConfig, params);

      const style = result.props.style as Record<string, unknown>;
      expect(style.flexDirection).toBe("column");
    });

    test("applies direction layout (row)", () => {
      const rowConfig: CustomTemplateConfig = {
        ...basicConfig,
        layout: { ...basicConfig.layout, direction: "row" },
      };
      const params: OGParams = { title: "Test" };
      const result = buildTemplateFromConfig(rowConfig, params);

      const style = result.props.style as Record<string, unknown>;
      expect(style.flexDirection).toBe("row");
    });
  });

  describe("Variable Replacement", () => {
    const templateWithVariables: CustomTemplateConfig = {
      name: "variables-test",
      layout: {
        backgroundColor: "#{{bg}}",
        elements: [
          {
            type: "text",
            content: "{{title}}",
            color: "#{{titleColor}}",
            fontSize: 48,
          },
          {
            type: "text",
            content: "{{description}}",
            color: "#{{descColor}}",
            fontSize: 24,
            showIf: "description",
          },
        ],
      },
    };

    test("replaces titleColor variable", () => {
      const params: OGParams = { title: "Test", titleColor: "ff5500" };
      const result = buildTemplateFromConfig(templateWithVariables, params);

      const children = result.props.children as Array<{
        props?: { style?: { color?: string } };
      }>;
      const titleEl = children[0];
      expect(titleEl?.props?.style?.color).toBe("#ff5500");
    });

    test("titleColor falls back to fg", () => {
      const params: OGParams = { title: "Test", fg: "aabbcc" };
      const result = buildTemplateFromConfig(templateWithVariables, params);

      const children = result.props.children as Array<{
        props?: { style?: { color?: string } };
      }>;
      const titleEl = children[0];
      expect(titleEl?.props?.style?.color).toBe("#aabbcc");
    });

    test("descColor falls back to titleColor", () => {
      const params: OGParams = {
        title: "Test",
        description: "Desc",
        titleColor: "112233",
      };
      const result = buildTemplateFromConfig(templateWithVariables, params);

      const children = result.props.children as Array<{
        props?: { style?: { color?: string } };
      }>;
      const descEl = children[1];
      expect(descEl?.props?.style?.color).toBe("#112233");
    });

    test("descColor can be set independently", () => {
      const params: OGParams = {
        title: "Test",
        description: "Desc",
        titleColor: "111111",
        descColor: "999999",
      };
      const result = buildTemplateFromConfig(templateWithVariables, params);

      const children = result.props.children as Array<{
        props?: { style?: { color?: string } };
      }>;
      const titleEl = children[0];
      const descEl = children[1];
      expect(titleEl?.props?.style?.color).toBe("#111111");
      expect(descEl?.props?.style?.color).toBe("#999999");
    });
  });

  describe("Conditional Rendering (showIf)", () => {
    const conditionalConfig: CustomTemplateConfig = {
      name: "conditional-test",
      layout: {
        elements: [
          { type: "text", content: "{{title}}", fontSize: 48 },
          {
            type: "text",
            content: "{{description}}",
            fontSize: 24,
            showIf: "description",
          },
          {
            type: "image",
            src: "{{logo}}",
            width: 64,
            height: 64,
            showIf: "logo",
          },
          { type: "spacer", size: 20, showIf: "image" },
        ],
      },
    };

    test("shows element when condition is met", () => {
      const params: OGParams = { title: "Test", description: "My Description" };
      const result = buildTemplateFromConfig(conditionalConfig, params);

      const children = result.props.children as unknown[];
      // Should have title + description (2 elements)
      expect(children.length).toBe(2);
    });

    test("hides element when condition is not met", () => {
      const params: OGParams = { title: "Test" };
      const result = buildTemplateFromConfig(conditionalConfig, params);

      const children = result.props.children as unknown[];
      // Should only have title (1 element) - description hidden
      expect(children.length).toBe(1);
    });

    test("shows logo when logo param provided", () => {
      const params: OGParams = {
        title: "Test",
        logo: "https://example.com/logo.png",
      };
      const result = buildTemplateFromConfig(conditionalConfig, params);

      const children = result.props.children as Array<{ type?: string }>;
      const hasImage = children.some((c) => c.type === "img");
      expect(hasImage).toBe(true);
    });

    test("hides logo when logo param not provided", () => {
      const params: OGParams = { title: "Test" };
      const result = buildTemplateFromConfig(conditionalConfig, params);

      const children = result.props.children as Array<{ type?: string }>;
      const hasImage = children.some((c) => c.type === "img");
      expect(hasImage).toBe(false);
    });
  });

  describe("Element Types", () => {
    test("builds text element correctly", () => {
      const config: CustomTemplateConfig = {
        name: "text-test",
        layout: {
          elements: [
            {
              type: "text",
              content: "Hello",
              fontSize: 32,
              fontWeight: 600,
              color: "#ff0000",
              maxWidth: 500,
              lineHeight: 1.5,
              opacity: 0.8,
            },
          ],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const children = result.props.children as Array<{
        props?: { style?: Record<string, unknown> };
      }>;
      const textEl = children[0];

      expect(textEl?.props?.style?.fontSize).toBe(32);
      expect(textEl?.props?.style?.fontWeight).toBe(600);
      expect(textEl?.props?.style?.color).toBe("#ff0000");
      expect(textEl?.props?.style?.maxWidth).toBe(500);
      expect(textEl?.props?.style?.lineHeight).toBe(1.5);
      expect(textEl?.props?.style?.opacity).toBe(0.8);
    });

    test("builds image element correctly", () => {
      const config: CustomTemplateConfig = {
        name: "image-test",
        layout: {
          elements: [
            {
              type: "image",
              src: "{{logo}}",
              width: 100,
              height: 50,
              borderRadius: 8,
            },
          ],
        },
      };

      const params: OGParams = { logo: "https://example.com/logo.png" };
      const result = buildTemplateFromConfig(config, params);
      const children = result.props.children as Array<{
        type?: string;
        props?: { src?: string; width?: number; height?: number };
      }>;
      const imgEl = children[0];

      expect(imgEl?.type).toBe("img");
      expect(imgEl?.props?.src).toBe("https://example.com/logo.png");
      expect(imgEl?.props?.width).toBe(100);
      expect(imgEl?.props?.height).toBe(50);
    });

    test("builds spacer element correctly", () => {
      const config: CustomTemplateConfig = {
        name: "spacer-test",
        layout: {
          elements: [
            { type: "text", content: "Before", fontSize: 24 },
            { type: "spacer", size: 40 },
            { type: "text", content: "After", fontSize: 24 },
          ],
        },
      };

      const result = buildTemplateFromConfig(config, { title: "Test" });
      const children = result.props.children as Array<{
        type?: string;
        props?: { style?: { height?: number; width?: number } };
      }>;

      // Find spacer (div with height/width equal to size)
      const spacer = children.find(
        (c) => c.props?.style?.height === 40 && c.props?.style?.width === 40,
      );
      expect(spacer).toBeDefined();
    });

    test("builds box (container) element correctly", () => {
      const config: CustomTemplateConfig = {
        name: "box-test",
        layout: {
          elements: [
            {
              type: "box",
              backgroundColor: "#333333",
              padding: 20,
              direction: "row",
              align: "center",
              justify: "between",
              children: [
                { type: "text", content: "Left", fontSize: 16 },
                { type: "text", content: "Right", fontSize: 16 },
              ],
            },
          ],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const children = result.props.children as Array<{
        type?: string;
        props?: {
          style?: Record<string, unknown>;
          children?: unknown[];
        };
      }>;
      const boxEl = children[0];

      expect(boxEl?.props?.style?.backgroundColor).toBe("#333333");
      expect(boxEl?.props?.style?.padding).toBe(20);
      expect(boxEl?.props?.style?.flexDirection).toBe("row");
      expect(boxEl?.props?.style?.alignItems).toBe("center");
      expect(boxEl?.props?.style?.justifyContent).toBe("space-between");
      expect(boxEl?.props?.children?.length).toBe(2);
    });
  });

  describe("Background Options", () => {
    test("applies gradient background", () => {
      const config: CustomTemplateConfig = {
        name: "gradient-test",
        layout: {
          backgroundGradient:
            "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const style = result.props.style as Record<string, unknown>;
      expect(style.background).toBe(
        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      );
    });

    test("gradient takes precedence over backgroundColor", () => {
      const config: CustomTemplateConfig = {
        name: "gradient-precedence-test",
        layout: {
          backgroundColor: "#ff0000",
          backgroundGradient: "linear-gradient(135deg, #000 0%, #fff 100%)",
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const style = result.props.style as Record<string, unknown>;
      expect(style.background).toBe(
        "linear-gradient(135deg, #000 0%, #fff 100%)",
      );
      expect(style.backgroundColor).toBeUndefined();
    });
  });

  describe("Flex Alignment Conversion", () => {
    test("converts 'start' to 'flex-start'", () => {
      const config: CustomTemplateConfig = {
        name: "align-start-test",
        layout: {
          align: "start",
          justify: "start",
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const style = result.props.style as Record<string, unknown>;
      expect(style.alignItems).toBe("flex-start");
      expect(style.justifyContent).toBe("flex-start");
    });

    test("converts 'end' to 'flex-end'", () => {
      const config: CustomTemplateConfig = {
        name: "align-end-test",
        layout: {
          align: "end",
          justify: "end",
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const style = result.props.style as Record<string, unknown>;
      expect(style.alignItems).toBe("flex-end");
      expect(style.justifyContent).toBe("flex-end");
    });

    test("converts 'between' to 'space-between'", () => {
      const config: CustomTemplateConfig = {
        name: "justify-between-test",
        layout: {
          justify: "between",
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const style = result.props.style as Record<string, unknown>;
      expect(style.justifyContent).toBe("space-between");
    });

    test("keeps 'center' as 'center'", () => {
      const config: CustomTemplateConfig = {
        name: "align-center-test",
        layout: {
          align: "center",
          justify: "center",
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = buildTemplateFromConfig(config, {});
      const style = result.props.style as Record<string, unknown>;
      expect(style.alignItems).toBe("center");
      expect(style.justifyContent).toBe("center");
    });
  });

  describe("parseInlineTemplateConfig", () => {
    const validConfig = {
      name: "inline-test",
      layout: {
        backgroundColor: "#1a1a2e",
        padding: 60,
        elements: [{ type: "text", content: "{{title}}", fontSize: 48 }],
      },
    };

    test("parses base64-encoded config", () => {
      const base64 = btoa(JSON.stringify(validConfig));
      const result = parseInlineTemplateConfig(base64);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("inline-test");
      expect(result?.layout.elements.length).toBe(1);
    });

    test("parses URL-safe base64 config (- and _ characters)", () => {
      const json = JSON.stringify(validConfig);
      // Convert to URL-safe base64
      const base64 = btoa(json).replace(/\+/g, "-").replace(/\//g, "_");
      const result = parseInlineTemplateConfig(base64);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("inline-test");
    });

    test("parses URL-encoded JSON config", () => {
      const encoded = encodeURIComponent(JSON.stringify(validConfig));
      const result = parseInlineTemplateConfig(encoded);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("inline-test");
    });

    test("parses raw JSON starting with {", () => {
      const json = JSON.stringify(validConfig);
      const result = parseInlineTemplateConfig(json);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("inline-test");
    });

    test("adds default name if missing", () => {
      const configWithoutName = {
        layout: {
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };
      const base64 = btoa(JSON.stringify(configWithoutName));
      const result = parseInlineTemplateConfig(base64);

      expect(result).not.toBeNull();
      expect(result?.name).toBe("inline");
    });

    test("returns null for invalid JSON", () => {
      const result = parseInlineTemplateConfig("not-valid-json");
      expect(result).toBeNull();
    });

    test("returns null for missing layout", () => {
      const invalidConfig = { name: "test" };
      const base64 = btoa(JSON.stringify(invalidConfig));
      const result = parseInlineTemplateConfig(base64);

      expect(result).toBeNull();
    });

    test("returns null for missing elements", () => {
      const invalidConfig = { layout: { backgroundColor: "#fff" } };
      const base64 = btoa(JSON.stringify(invalidConfig));
      const result = parseInlineTemplateConfig(base64);

      expect(result).toBeNull();
    });
  });

  describe("validateTemplateConfig", () => {
    test("validates correct config", () => {
      const config: CustomTemplateConfig = {
        name: "valid",
        layout: {
          elements: [{ type: "text", content: "Test", fontSize: 24 }],
        },
      };

      const result = validateTemplateConfig(config);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    test("rejects config without layout", () => {
      const config = { name: "invalid" } as unknown as CustomTemplateConfig;

      const result = validateTemplateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing layout property");
    });

    test("rejects config without elements array", () => {
      const config = {
        name: "invalid",
        layout: { backgroundColor: "#fff" },
      } as unknown as CustomTemplateConfig;

      const result = validateTemplateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("layout.elements must be an array");
    });

    test("rejects invalid element type", () => {
      const config: CustomTemplateConfig = {
        name: "invalid",
        layout: {
          elements: [
            { type: "invalid-type" as "text", content: "Test", fontSize: 24 },
          ],
        },
      };

      const result = validateTemplateConfig(config);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid element type: invalid-type");
    });

    test("accepts all valid element types", () => {
      const config: CustomTemplateConfig = {
        name: "valid-types",
        layout: {
          elements: [
            { type: "text", content: "Test", fontSize: 24 },
            {
              type: "image",
              src: "https://example.com/img.png",
              width: 64,
              height: 64,
            },
            { type: "box", children: [] },
            { type: "spacer", size: 20 },
          ],
        },
      };

      const result = validateTemplateConfig(config);
      expect(result.valid).toBe(true);
    });
  });
});
