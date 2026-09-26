import { test, expect } from '@playwright/test';
import { saveDetailsBoard, openSaveDetails, saveTrigger } from './save-details-fixtures';

test('@04-07-01 saved empty board opens named details with keyboard focus and acknowledged time', async ({ page, baseURL }) => {
  await saveDetailsBoard(page, baseURL!);
  await expect(saveTrigger(page)).toContainText('Saved');
  const dialog = await openSaveDetails(page);
  await expect(dialog.getByRole('heading', { name: 'Save details' })).toBeFocused();
  await expect(dialog).toContainText('All changes and images are saved to the server.');
  await expect(dialog).toContainText('Last saved to the server:');
  await expect(dialog.getByRole('list')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Retry now' })).toHaveCount(0);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0); await expect(saveTrigger(page)).toBeFocused();
});
