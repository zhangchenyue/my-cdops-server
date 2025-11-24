const { chromium } = require("playwright");
const os = require("os");
const config = require("./config");

async function sendData(data, type) {
  console.log("Send: ", data);
  if (type === "swagger") {
    console.log("count: ", data.length);
  }
}
async function updateSwaggerInfo(chromiumPage, opsSwaggers) {
  console.log("opsSwaggers: ", opsSwaggers);
  let envSwagerData = [];
  let isRunning = false;
  chromiumPage.on("response", async (response) => {
    if (response.url().includes("/routes?")) {
      try {
        const body = await response.body();
        const resp = JSON.parse(body.toString());
        const swaggerData = resp.data
          .filter((i) => i.name.includes("-internal-") && i.expression.split("/").length <= 4)
          .map((it) => {
            const origin = new URL(response.url()).origin;
            const host = (it.expression.match(/http\.host == "([^"]+)"/) || [])[1] || null;
            const path = (it.expression.match(/http\.path \^= "([^"]+)"/) || [])[1] || null;
            const swaggerUrl = `${origin}/${host}${path}/swagger`;
            return {
              serviceName: it.name.split(/\.|-internal-/)[1],
              scope: it.name.split(".")[0],
              swaggerUrl,
              updatedTime: new Date(it.updated_at * 1000).toISOString()
            };
          });
        envSwagerData.push(...swaggerData);
        if (!resp.next) {
          //   sendData(envSwagerData, "swagger");
          envSwagerData = [];
          isRunning = false;
        }
      } catch (error) {
        console.error("Failed to get content data from swagger:", error);
      }
    }
  });

  for (const item of opsSwaggers) {
    while (isRunning) {
      await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for 100ms before checking again
    }
    isRunning = true;
    await chromiumPage.goto(item.url);
    console.log("item:", item);
  }

  return;
}

async function updateInfo(chromiumContext, opsPortalUrl) {
  const page =
    chromiumContext.pages().length > 0
      ? chromiumContext.pages()[0]
      : await chromiumContext.newPage();
  const pageSwagger = await chromiumContext.newPage();
  page.on("response", async (response) => {
    if (response.url().includes("/portals")) {
      try {
        const body = await response.body();
        const opsData = JSON.parse(body.toString());
        sendData(JSON.parse(body.toString()));
        const opsSwaggers = Object.keys(opsData)
          .filter((key) => !!opsData[key].Swagger?.url && key !== "15_lptest2_lpt")
          .map((k) => ({ id: k, url: opsData[k].Swagger.url }));
        await new Promise((resolve) => setTimeout(resolve, 10 * 1000));
        await updateSwaggerInfo(pageSwagger, opsSwaggers);
      } catch (error) {
        console.error("Failed to get content data from ops portal:", error);
      }
    }
  });
  await page.goto(opsPortalUrl);
  try {
    await page.locator("#social-oidc").click({ timeout: 5000 });
    console.log("Login button clicked, waiting for navigation...");
  } catch (error) {
    console.log("Login button not found, assuming already logged in.");
  }

  console.log("Starting refresh loop every 2 minutes...");
  setInterval(async () => {
    try {
      console.log("Deleting session cookie and refreshing...");
      const allCookies = await chromiumContext.cookies();
      const cookiesToKeep = allCookies.filter((cookie) => cookie.name !== "session");
      await chromiumContext.clearCookies();
      if (cookiesToKeep.length > 0) {
        await chromiumContext.addCookies(cookiesToKeep);
      }
      await page.reload();
      console.log("Page refreshed successfully.");
      try {
        await page.locator("#social-oidc").click({ timeout: 5000 });
        console.log("Login button clicked, waiting for navigation...");
      } catch (error) {
        console.log("Login button not found, assuming already logged in.");
      }
    } catch (error) {
      console.error("An error occurred during the refresh loop:", error);
    }
  }, 2 * 60 * 1000); // 2 minutes in milliseconds
}

async function launchChromeContext() {
  const { CHROME_WIN_FOLDER, CHROME_MAC_FOLDER, CHROME_WIN_APP, CHROME_MAC_APP } = config;
  const platform = os.platform();
  const chromeFolder = platform === "win32" ? CHROME_WIN_FOLDER : CHROME_MAC_FOLDER;
  const chromeApp = platform === "win32" ? CHROME_WIN_APP : CHROME_MAC_APP;
  const context = await chromium.launchPersistentContext(chromeFolder, {
    executablePath: chromeApp,
    headless: false
  });
  return context;
}

async function main() {
  const { OPS_PORTAL_URL } = config;
  const context = await launchChromeContext();
  await updateInfo(context, OPS_PORTAL_URL);
}

main();
