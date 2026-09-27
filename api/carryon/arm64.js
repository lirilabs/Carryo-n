const GITHUB_API =
  "https://api.github.com/repos/sanjay434343/Carryon/releases/latest";

const APK_NAME = "app-arm64-v8a-release.apk";

module.exports = async (req, res) => {
  try {
    const response = await fetch(GITHUB_API, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "carryon-release-launcher"
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
        error: "ARM64 APK not found",
        version: release.tag_name
      });
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Location", asset.browser_download_url);

    return res.status(302).end();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to find latest Carryon release",
      message: error.message
    });
  }
};
