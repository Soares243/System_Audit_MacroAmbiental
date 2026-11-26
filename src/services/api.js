import axios from "axios";

const api = axios.create({
  baseURL: "https://backend-an54.onrender.com/api",
  timeout: 20000
});
let avisoConexaoMostrado = false;
const RETRYABLE_METHODS = new Set(["get", "head", "options"]);

// Interceptor de resposta para redirecionar ao receber 401 (token invalido/expirado)
api.interceptors.response.use(
  response => response,
  async (error) => {
    const requestConfig = error?.config || {};
    const metodo = String(requestConfig?.method || "").toLowerCase();
    const semResposta = !error.response;

    if (semResposta && RETRYABLE_METHODS.has(metodo) && !requestConfig.__retryNetwork) {
      requestConfig.__retryNetwork = true;
      await new Promise((resolve) => setTimeout(resolve, 800));
      return api(requestConfig);
    }

    if (!error.response) {
      if (!avisoConexaoMostrado) {
        avisoConexaoMostrado = true;
        alert("Sem conexao com o servidor. As tabelas podem aparecer vazias.");
        setTimeout(() => {
          avisoConexaoMostrado = false;
        }, 5000);
      }
      return Promise.reject(error);
    }

    if (error.response && error.response.status === 401) {
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;
