import { test, expect } from '@playwright/test';
function pdfFixture() {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Contents 5 0 R >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Contents 5 0 R >>', '<< /Length 29 >>\nstream\n0.2 0.4 0.3 rg 0 0 640 360 re f\nendstream'];
  let body = '%PDF-1.4\n'; const offsets = [0];
  for (let i = 0; i < objects.length; i++) { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`; }
  const xref = Buffer.byteLength(body); body += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}
test('demo advances one slide at a time and resets', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'デモを再生' }).click();
  await expect(page.locator('.demo-slide')).toHaveCount(1);
  await page.getByRole('button', { name: '次のスライド' }).click();
  await expect(page.locator('.demo-slide')).toHaveCount(2);
  await expect(page.locator('.slide-request').last()).toHaveText('2枚目のスライドを生成して。');
  await expect(page.locator('.playback')).not.toContainText('/ 04');
  await page.locator('main').click({ position: { x: 10, y: 90 } }); await page.keyboard.press('ArrowRight');
  await expect(page.locator('.demo-slide')).toHaveCount(3);
  await page.getByRole('button', { name: '自動送り', exact: true }).click();
  await expect(page.locator('.demo-slide')).toHaveCount(4, { timeout: 10000 });
  await page.getByRole('button', { name: '最初からやり直す' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.screenshot({ path: 'test-results/desktop.png', fullPage: true });
});
test('local PDF renders and invalid files are rejected', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  await expect(page.getByRole('alert')).toContainText('読み込めません');
  await page.locator('input[type=file]').setInputFiles({ name: 'slides.pdf', mimeType: 'application/pdf', buffer: pdfFixture() });
  await expect(page.locator('.upload-card')).toContainText('2枚');
  await page.getByRole('button', { name: 'プレゼンテーションを開始' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(() => page.locator('canvas').evaluate(c => c.getContext('2d').getImageData(100,100,1,1).data[1])).toBeGreaterThan(50);
  await page.getByRole('button', { name: '次のスライド' }).click();
  await expect(page.locator('canvas')).toHaveCount(2);
  await expect(page.getByRole('button', { name: '生成完了' })).toBeDisabled();
  const fits = () => page.locator('canvas').last().evaluate(el => {
    const slide = el.getBoundingClientRect();
    const controls = document.querySelector('.playback').getBoundingClientRect();
    const header = document.querySelector('header').getBoundingClientRect();
    return slide.top >= header.bottom && slide.bottom <= controls.top && slide.left >= document.querySelector('.sidebar').getBoundingClientRect().right && slide.right <= innerWidth;
  });
  await expect(page.locator('.sidebar')).toBeInViewport();
  await expect.poll(fits).toBe(true);
  expect((await page.locator('canvas').last().boundingBox()).width).toBeGreaterThan(1300);
  await page.screenshot({ path: 'test-results/presentation.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.sidebar')).toBeInViewport();
  await expect.poll(fits).toBe(true);

});
test('mobile fits viewport and opens navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'メニュー', exact: true }).click();
  await expect(page.getByRole('button', { name: '新しいプレゼン' })).toBeInViewport();
  await page.getByRole('button', { name: '新しいプレゼン' }).click();
  await expect.poll(() => page.locator('.sidebar').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
});

test('left arrow goes back, stops autoplay, and stays at the first slide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'デモを再生' }).click();
  await expect(page.locator('.demo-slide')).toHaveCount(1);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.demo-slide')).toHaveCount(1);
  await page.getByRole('button', { name: '次のスライド' }).click();
  await expect(page.locator('.demo-slide')).toHaveCount(2);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.demo-slide')).toHaveCount(1);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.demo-slide')).toHaveCount(2);
  await page.getByRole('button', { name: '自動送り', exact: true }).click();
  await expect(page.getByRole('status')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.demo-slide')).toHaveCount(1);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '自動送り', exact: true })).toBeVisible();
  // Wait beyond the cancelled generation timer to detect an unwanted advance.
  await page.waitForTimeout(1200);
  await expect(page.locator('.demo-slide')).toHaveCount(1);
});
