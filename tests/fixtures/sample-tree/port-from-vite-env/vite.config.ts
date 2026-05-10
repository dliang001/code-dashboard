const WEB_PORT = Number(process.env.PORT || process.env.VITE_PORT) || 5780;

export default {
  server: {
    host: "127.0.0.1",
    port: WEB_PORT,
  },
};
