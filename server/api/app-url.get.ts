import os from "os";
import { getRequestURL } from "h3";

const getLocalIpAddress = () => {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    if (!entries) {
      continue;
    }
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }
  return null;
};

export default defineEventHandler((event) => {
  const requestUrl = getRequestURL(event);
  const localIp = getLocalIpAddress() ?? requestUrl.hostname;
  const protocol = requestUrl.protocol || "http:";
  const port = requestUrl.port ? `:${requestUrl.port}` : "";

  return {
    url: `${protocol}//${localIp}${port}`,
  };
});
