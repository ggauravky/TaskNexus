async page => {
  const widths = [320, 375, 390, 430, 768, 1024, 1440];
  const results = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(50);
    results.push(await page.evaluate((viewportWidth) => ({
      width: viewportWidth,
      bodyScrollWidth: document.body.scrollWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      h1Count: document.querySelectorAll("h1").length,
      activeTab: document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.trim() || null,
    }), width));
  }
  return results;
}
