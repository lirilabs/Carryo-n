const GITHUB_API =
  "https://api.github.com/repos/sanjay434343/Carryon/releases/latest";

const APK_NAME = "app-armeabi-v7a-release.apk";
const APK_TYPE = "ARMv7 APK";

function successPage(version, downloadUrl) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>Carryon Download</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f7f8f5;
      font-family: Arial, sans-serif;
      color: #111;
    }

    .container {
      text-align: center;
      padding: 30px;
    }

    .check {
      width: 90px;
      height: 90px;
      margin: 0 auto 25px;
      border-radius: 50%;
      background: #d7ff70;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 48px;
      font-weight: bold;
    }

    h1 {
      margin: 0 0 10px;
      font-size: 28px;
    }

    p {
      margin: 6px 0;
      color: #666;
    }

    .version {
      margin-top: 20px;
      font-size: 14px;
      color: #999;
    }
  </style>
</head>

<body>

  <div class="container">

    <div class="check">✓</div>

    <h1>Download Ready</h1>

    <p>Carryon ${APK_TYPE}</p>

    <div class="version">
      Version ${version}
    </div>

  </div>

  <script>
    setTimeout(() => {
      window.location.href = ${JSON.stringify(downloadUrl)};
    }, 1200);
  </script>

</body>
</html>
`;
}

module.exports = async (req, res) => {
  try {

    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "carryon-vercel-launcher"
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const release = await response.json();

    const asset = release.assets?.find(
      item => item.name === APK_NAME
    );

    if (!asset) {
      return res.status(404).json({
        error: "ARMv7 APK not found",
        version: release.tag_name
      });
    }

    res.setHeader(
      "Content-Type",
      "text/html; charset=utf-8"
    );

    res.setHeader(
      "Cache-Control",
      "no-store"
    );

    return res.status(200).send(
      successPage(
        release.tag_name,
        asset.browser_download_url
      )
    );

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Failed to find latest Carryon release",
      message: error.message
    });

  }
};
