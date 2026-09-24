import type { Locator, Page } from '@playwright/test';

export async function openBoardActions(card: Locator) {
  const actions = card.locator('.board-card__actions');
  if (await actions.getAttribute('open') === null) await actions.locator('summary').click();
}

export async function boardAction(card: Locator, name: 'Rename board' | 'Duplicate board' | 'Share board' | 'Delete board') {
  await openBoardActions(card);
  await card.getByRole('button', { name, exact: true }).click();
}

export async function openAccount(page: Page) {
  const menu = page.locator('.board-account');
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
}

export async function fileAction(page: Page, name: 'New' | 'All boards' | 'Import board' | 'Export board') {
  await page.getByRole('button', { name: 'Main Menu', exact: true }).click();
  await page.getByRole('menuitem', { name: 'File', exact: true }).click();
  await page.getByRole('menuitem', { name, exact: true }).click();
}

export async function editBoardTitle(page: Page) {
  await page.getByRole('button', { name: /^Rename board:/ }).click();
  return page.getByRole('textbox', { name: 'Board name', exact: true });
}

export async function openLocalBoardCopy(page: Page) {
  const menu = page.locator('.board-library__import');
  if (await menu.getAttribute('open') === null) await menu.locator('summary').click();
  await page.getByRole('button', { name: 'Copy local boards', exact: true }).click();
}
