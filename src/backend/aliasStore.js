import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export class AliasStore {
  constructor(dataDir = process.env.HVAC_DATA_DIR || path.join(root, ".data")) {
    this.filePath = path.join(dataDir, "aliases.json");
  }

  async apply(units) {
    const aliases = await this.read();
    return units.map((unit) => {
      const alias = aliases[String(unit.idx)] || "";
      return {
        ...unit,
        alias,
        name: alias || unit.name
      };
    });
  }

  async set(idx, alias) {
    const aliases = await this.read();
    const key = String(idx);
    const value = String(alias || "").trim();

    if (value) {
      aliases[key] = value;
    } else {
      delete aliases[key];
    }

    await this.write(aliases);
    return { idx, alias: value };
  }

  async read() {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return {};
      throw error;
    }
  }

  async write(aliases) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(aliases, null, 2), "utf8");
  }
}
