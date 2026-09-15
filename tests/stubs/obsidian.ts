/** The `obsidian` package ships types only, so Vitest cannot resolve it; the
    alias in vitest.config.mts points here. Nothing under test imports a value
    from `obsidian` at run time, so the module stands in as an empty module. */
export {};
