import type { Locator, Page } from "@playwright/test";

// CustomSelect renders a combobox button plus a listbox that exists only while open;
// the selected value lives in a hidden input named after the field.

export async function openOptions(trigger: Locator): Promise<Locator> {
  if ((await trigger.getAttribute("aria-expanded")) !== "true") {
    await trigger.click();
  }
  const listId = await trigger.getAttribute("aria-controls");
  return trigger.page().locator(`[id="${listId}"]`).getByRole("option");
}

export async function chooseOption(
  trigger: Locator,
  label: string | RegExp,
): Promise<void> {
  const options = await openOptions(trigger);
  await options.filter({ hasText: label }).first().click();
}

export function selectedValue(page: Page, name: string): Promise<string> {
  return page.locator(`input[type="hidden"][name="${name}"]`).inputValue();
}
