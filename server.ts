import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "50mb" })); // Increase limit for larger structures

// --- Korea Investment API Express Proxies ---

// Target URL mapping helper
function getKoreaInvestBaseUrl(apiType?: string, customUrl?: string): string {
  if (apiType === "mock") {
    return "https://openapim.koreainvestment.com:29443";
  }
  if (apiType === "mock_443") {
    return "https://openapim.koreainvestment.com";
  }
  if (apiType === "real_443") {
    return "https://openapi.koreainvestment.com";
  }
  if (apiType === "legacy") {
    return "https://koreainvestment.com";
  }
  if (apiType === "custom" && customUrl) {
    const formatted = customUrl.trim();
    if (formatted.startsWith("http://") || formatted.startsWith("https://")) {
      return formatted.replace(/\/$/, "");
    }
  }
  // Default is official Real investment server (explicit port 9443 or default)
  if (apiType === "real") {
    return "https://openapi.koreainvestment.com:9443";
  }
  return "https://openapi.koreainvestment.com:9443";
}

// 1. Issuing Access Token (Bearer)
app.post("/api/koreainvest/token", async (req, res) => {
  const { appkey, appsecret, api_type, custom_url } = req.body;
  if (!appkey || !appsecret) {
    return res.status(400).json({ error: "appkey와 appsecret은 필수 입력 항목입니다." });
  }

  const baseDomain = getKoreaInvestBaseUrl(api_type, custom_url);
  const url = `${baseDomain}/oauth2/tokenP`;

  try {
    console.log(`한투 토큰 요청 전송 대상: ${url}`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: appkey.trim(),
        appsecret: appsecret.trim(),
      }),
    });

    const data = await response.json();
    if (data.access_token) {
      res.json({
        access_token: `Bearer ${data.access_token}`,
        expires_in: data.expires_in || 86400,
      });
    } else {
      console.warn("한투 토큰 응답 실패 바디:", data);
      const errMsg = data.error_description || data.msg1 || "인증 토큰 발급에 실패했습니다. 키 값과 서버 권한을 다시 입력 후 확인해주세요.";
      res.status(400).json({ error: errMsg, details: data });
    }
  } catch (error) {
    console.error("한투 토큰 발급 중 서버 에러:", error);
    res.status(500).json({ error: `한투 서버(${baseDomain}) 통신 도중 에러가 발생했습니다.`, details: (error as Error).message });
  }
});

// 2. Fetch Single Stock Price
app.post("/api/koreainvest/stock-price", async (req, res) => {
  const { token, appkey, appsecret, stock_code, api_type, custom_url } = req.body;
  if (!token || !appkey || !appsecret || !stock_code) {
    return res.status(400).json({ error: "token, appkey, appsecret, stock_code는 필수 항목입니다." });
  }

  const baseDomain = getKoreaInvestBaseUrl(api_type, custom_url);
  const url = `${baseDomain}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${stock_code.trim()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "authorization": token,
        "appkey": appkey.trim(),
        "appsecret": appsecret.trim(),
        "tr_id": "FHKST01010100"
      },
    });

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(`한투 주가 조회 중 서버 에러 (종목코드 ${stock_code}):`, error);
    res.status(500).json({ error: `한투 서버(${baseDomain}) 통신 중 에러가 발생했습니다.`, details: (error as Error).message });
  }
});

// 3. Fetch Bulk Stock Prices (Sequential with a small delay to avoid rate bounds/TPS exclusions)
app.post("/api/koreainvest/stock-prices-bulk", async (req, res) => {
  const { token, appkey, appsecret, stock_codes, api_type, custom_url } = req.body;
  if (!token || !appkey || !appsecret || !stock_codes || !Array.isArray(stock_codes)) {
    return res.status(400).json({ error: "token, appkey, appsecret, stock_codes(배열)는 필수 항목입니다." });
  }

  const baseDomain = getKoreaInvestBaseUrl(api_type, custom_url);
  const results: Record<string, any> = {};

  for (const code of stock_codes) {
    try {
      const url = `${baseDomain}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${code.trim()}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "authorization": token,
          "appkey": appkey.trim(),
          "appsecret": appsecret.trim(),
          "tr_id": "FHKST01010100"
        },
      });
      const data = await response.json();
      results[code] = data;
      // 70ms safety buffer to fit average 20 TPS limits on personal key configs
      await new Promise((resolve) => setTimeout(resolve, 70));
    } catch (error) {
      results[code] = { error: "통신 실패", details: (error as Error).message };
    }
  }

  res.json(results);
});

// 4. Test Connectivity to Korea Investment servers (Diagnostics API)
app.get("/api/koreainvest/test-connection", async (req, res) => {
  const targets = [
    { name: "실전투자망 기본 포트 (9443)", url: "https://openapi.koreainvestment.com:9443" },
    { name: "실전투자망 웹 표준 포트 (443)", url: "https://openapi.koreainvestment.com" },
    { name: "모의투자망 기본 포트 (29443)", url: "https://openapim.koreainvestment.com:29443" },
    { name: "모의투자망 웹 표준 포트 (443)", url: "https://openapim.koreainvestment.com" },
    { name: "기본 웹 서버 도메인", url: "https://koreainvestment.com" }
  ];

  const results = [];

  for (const t of targets) {
    const startTime = Date.now();
    try {
      // Use controller to abort after 3.5 seconds
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);

      // We request token path or root path just to test network and DNS reachability
      const testUrl = `${t.url}/oauth2/tokenP`;
      const response = await fetch(testUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grant_type: "client_credentials", appkey: "test", appsecret: "test" }),
        signal: controller.signal
      });

      clearTimeout(id);
      const duration = Date.now() - startTime;
      
      // Even if response is 400 or 500 (since we passed "test"), it means the server is reachable and shook hands!
      results.push({
        name: t.name,
        url: t.url,
        reachable: true,
        status: response.status,
        duration: `${duration}ms`,
        msg: "서버가 활성화되어 있으며 통신 가능합니다. (핸드셰이크 정상)"
      });
    } catch (err: any) {
      const duration = Date.now() - startTime;
      let errorMsg = err.message || String(err);
      if (err.name === "AbortError" || errorMsg.includes("timeout")) {
        errorMsg = "접속 제한시간 초과 (Timeout) - 방화벽 또는 클라우드 보안 그룹에 의해 포트나 외부 통신이 차단되었을 수 있습니다.";
      } else if (errorMsg.includes("ENOTFOUND")) {
        errorMsg = "도메인 주소를 찾을 수 없음 (DNS ENOTFOUND) - 해당 주소가 존재하지 않거나 DNS 확인이 불가능합니다.";
      } else if (errorMsg.includes("ECONNREFUSED")) {
        errorMsg = "포트가 닫혀있음 (ECONNREFUSED) - 서버가 해당 포트에서의 요청을 거절했거나 방화벽 규칙에 의해 거절되었습니다.";
      }

      results.push({
        name: t.name,
        url: t.url,
        reachable: false,
        duration: `${duration}ms`,
        msg: errorMsg
      });
    }
  }

  res.json({
    timestamp: new Date().toISOString(),
    results
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
