export const normalizeDefinitionList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(/\n|;/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
};

const uniqueStrings = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

const buildFamilyToolIndex = (records: any[]) => {
  const index = new Map<string, Set<string>>();
  (records || []).forEach((record) => {
    const families = normalizeDefinitionList(record?.tool_family);
    const tools = normalizeDefinitionList(record?.applicable_tools ?? record?.tool_id);
    families.forEach((family) => {
      const set = index.get(family) ?? new Set<string>();
      tools.forEach((tool) => set.add(tool));
      index.set(family, set);
    });
  });
  return index;
};

export const deriveToolPropagation = (
  records: any[],
  selectedFamilies: unknown,
  selectedTools: unknown = [],
) => {
  const families = normalizeDefinitionList(selectedFamilies);
  if (families.length === 0) {
    return {
      families: [] as string[],
      familyChips: [] as Array<{ family: string; toolCount: number }>,
      availableTools: [] as string[],
      selectedTools: [] as string[],
    };
  }

  const familyIndex = buildFamilyToolIndex(records || []);
  const availableTools = uniqueStrings(
    families.flatMap((family) => Array.from(familyIndex.get(family) || [])),
  );
  const selected = normalizeDefinitionList(selectedTools).filter((tool) => availableTools.includes(tool));
  const familyChips = families.map((family) => ({
    family,
    toolCount: familyIndex.get(family)?.size || 0,
  }));

  return {
    families,
    familyChips,
    availableTools,
    selectedTools: selected,
  };
};
