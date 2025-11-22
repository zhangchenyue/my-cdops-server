const { chromium } = require("playwright");

const userChromeContextFolder = "/Users/CZhang13/Library/Application Support/Google/Chrome/Default";
async function captureAjaxWithPlaywright() {
  const context = await chromium.launchPersistentContext(userChromeContextFolder, {
    headless: false
  });
  //   const context = await browser.newContext();
  const page = await context.newPage();

  // 监听网络请求
  page.on("response", async (response) => {
    console.log("捕获url:", response.url());
    if (response.url().includes("/portals")) {
      console.log("捕获请求:", response.url());
      try {
        const body = await response.body();
        console.log("响应内容:", body.toString());
      } catch (error) {
        console.log("获取内容失败");
      }
    }
  });

  // 处理认证流程（Playwright 的等待更智能）
  await page.goto("https://portal.ops.rcis.cloud.slb-ds.com");
//   await page.click("#social-oidc");

  // 捕获主页AJAX
  //   await page.waitForTimeout(25000);

  // Periodically delete the session cookie and refresh the page
  console.log("Starting refresh loop every 2 minutes...");
  setInterval(async () => {
    try {
      console.log("Deleting 'session' cookie and refreshing...");

      // Get all cookies
      const allCookies = await context.cookies();
      // Filter out the 'session' cookie
      const cookiesToKeep = allCookies.filter((cookie) => cookie.name !== "session");

      // Clear all cookies
      await context.clearCookies();
      // Add back all cookies except for the 'session' one
      if (cookiesToKeep.length > 0) {
        await context.addCookies(cookiesToKeep);
      }

      // Refresh the page
      await page.reload();
      console.log("Page refreshed successfully.");
    } catch (error) {
      console.error("An error occurred during the refresh loop:", error);
    }
  }, 10 * 1000); // 2 minutes in milliseconds

//   await page.waitForURL("&zwnj;**/home**&zwnj;"); // 智能等待URL变化
  // Keep the script running
  await new Promise(() => {});
}

captureAjaxWithPlaywright();
