
import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import Select from "react-select";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import Layout from "../components/Layout";
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, LabelList,
  AreaChart, Area
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { DateRangePicker } from "rsuite";
import "rsuite/dist/rsuite.min.css";

const GERENTES_DASHBOARD = [
  "Caio Cesar Oliveira da Silva",
  "Renan Wendel Neves dos Santos"
];




export default function Dashboard() {
  const { token } = useContext(AuthContext);
  const usuarioLogado = token ? JSON.parse(atob(token.split(".")[1])) : null;
  const tipoUsuario = String(usuarioLogado?.tipo || "").trim().toUpperCase();
  const isAdmin = tipoUsuario === "ADMIN";
  const isDeveloper = tipoUsuario === "DEVELOPER";
  const isCoordenador = tipoUsuario === "COORDENADOR";
  const isSupervisor = tipoUsuario === "SUPERVISOR";
  const isPadrao = tipoUsuario === "PADRAO";
  const podeVerGraficoConcluidasPorDia = !isPadrao && !isSupervisor && !isCoordenador;
  const podeVerNotas = isAdmin || isDeveloper;
  const loginUsuarioLogado = String(usuarioLogado?.usuario || "").trim();
  const nomeUsuarioLogadoExibicao = String(
    usuarioLogado?.nome || usuarioLogado?.name || ""
  ).trim();
  const idUsuarioLogado = String(usuarioLogado?.id || "").trim();
  const [nomeUsuarioPerfilExibicao, setNomeUsuarioPerfilExibicao] = useState(
    nomeUsuarioLogadoExibicao
  );
  const [nomeCoordenadorLogado, setNomeCoordenadorLogado] = useState("");
    // Estado para seleção de gráficos no relatório
    const [graficosSelecionados, setGraficosSelecionados] = useState([
      "grafico-impactos",
      "grafico-impactos-atividade",
      "grafico-setor",
      "grafico-funcionario",
      "grafico-periodo"
    ]);
  // Drilldown de gráficos (deve estar dentro do componente)
  const [drilldownDia, setDrilldownDia] = useState(null);
  const [drilldownCoord, setDrilldownCoord] = useState(null);
  const [drilldownSetor, setDrilldownSetor] = useState(null);
  const [setores, setSetores] = useState([]);
  const [subsetores, setSubsetores] = useState([]);
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const [isMobileView, setIsMobileView] = useState(
    typeof window !== "undefined" ? window.innerWidth <= 768 : false
  );

    useEffect(() => {
      function atualizarViewport() {
        setIsMobileView(window.innerWidth <= 768);
      }

      atualizarViewport();
      window.addEventListener("resize", atualizarViewport);
      return () => window.removeEventListener("resize", atualizarViewport);
    }, []);

    useEffect(() => {
      let ativo = true;

      async function resolverNomeCoordenador() {
        if (!isCoordenador) {
          if (ativo) setNomeCoordenadorLogado("");
          return;
        }

        const nomeToken = String(usuarioLogado?.nome || usuarioLogado?.name || "").trim();
        if (nomeToken) {
          if (ativo) setNomeCoordenadorLogado(nomeToken);
          return;
        }

        if (!idUsuarioLogado) return;

        try {
          const me = await api.get("/usuarios/me");
          const nome = String(me?.data?.nome || "").trim();
          if (nome) {
            if (ativo) setNomeCoordenadorLogado(nome);
            return;
          }
        } catch {
          // ignora fallback sem resposta
        }

        try {
          const usuario = await api.get(`/usuarios/${idUsuarioLogado}`);
          const nome = String(usuario?.data?.nome || "").trim();
          if (nome && ativo) {
            setNomeCoordenadorLogado(nome);
            return;
          }
        } catch {
          // ignora fallback sem resposta
        }

        try {
          const usuarios = await api.get("/usuarios");
          const encontrado = (usuarios?.data || []).find(
            (u) => String(u?.id || "").trim() === idUsuarioLogado
          );
          const nome = String(encontrado?.nome || "").trim();
          if (ativo) setNomeCoordenadorLogado(nome);
        } catch {
          // ignora fallback sem resposta
        }
      }

      resolverNomeCoordenador();

      return () => {
        ativo = false;
      };
    }, [isCoordenador, idUsuarioLogado, usuarioLogado?.nome, usuarioLogado?.name]);

    useEffect(() => {
      let ativo = true;

      async function resolverNomePerfil() {
        const nomeToken = String(usuarioLogado?.nome || usuarioLogado?.name || "").trim();
        if (nomeToken && normalizarNome(nomeToken) !== normalizarNome(loginUsuarioLogado)) {
          if (ativo) setNomeUsuarioPerfilExibicao(nomeToken);
          return;
        }

        if (!idUsuarioLogado) {
          if (ativo) setNomeUsuarioPerfilExibicao(nomeToken);
          return;
        }

        try {
          const me = await api.get("/usuarios/me");
          const nome = String(me?.data?.nome || "").trim();
          if (nome) {
            if (ativo) setNomeUsuarioPerfilExibicao(nome);
            return;
          }
        } catch {
          // ignora fallback sem resposta
        }

        try {
          const usuario = await api.get(`/usuarios/${idUsuarioLogado}`);
          const nome = String(usuario?.data?.nome || "").trim();
          if (nome) {
            if (ativo) setNomeUsuarioPerfilExibicao(nome);
            return;
          }
        } catch {
          // ignora fallback sem resposta
        }

        try {
          const usuarios = await api.get("/usuarios");
          const encontrado = (usuarios?.data || []).find(
            (u) =>
              String(u?.id || "").trim() === idUsuarioLogado ||
              normalizarNome(u?.usuario) === normalizarNome(loginUsuarioLogado)
          );
          const nome = String(encontrado?.nome || "").trim();
          if (nome) {
            if (ativo) setNomeUsuarioPerfilExibicao(nome);
            return;
          }
        } catch {
          // ignora fallback sem resposta
        }

        if (ativo) {
          setNomeUsuarioPerfilExibicao(nomeToken);
        }
      }

      resolverNomePerfil();

      return () => {
        ativo = false;
      };
    }, [idUsuarioLogado, loginUsuarioLogado, usuarioLogado?.nome, usuarioLogado?.name]);

    // Filtros multi-select
    const [filtroCoord, setFiltroCoord] = useState([]);
        useEffect(() => {
          if (!isCoordenador) return;
          if (!nomeCoordenadorLogado) return;

          if (
            filtroCoord.length !== 1 ||
            String(filtroCoord[0]?.value || "").trim() !== nomeCoordenadorLogado
          ) {
            setFiltroCoord([
              {
                value: nomeCoordenadorLogado,
                label: nomeCoordenadorLogado
              }
            ]);
          }
        }, [isCoordenador, nomeCoordenadorLogado, filtroCoord]);
  const [filtroSetorMulti, setFiltroSetorMulti] = useState([]);
  const [filtroSubsetor, setFiltroSubsetor] = useState([]);
  const [filtroSupervisor, setFiltroSupervisor] = useState([]);
  const [filtroFuncionario, setFiltroFuncionario] = useState([]);
  const [filtroAtividade, setFiltroAtividade] = useState([]);
  const [filtrosRestaurados, setFiltrosRestaurados] = useState(false);
    // Drilldown coordenador > setor > subsetor
    const [coordenadorSelecionado] = useState(null);
    const [setorSelecionado] = useState(null);
    const [registros, setRegistros] = useState([]);
    const [tarefas, setTarefas] = useState([]);
  const [graficoAtivo, setGraficoAtivo] = useState(1);
  const [notaFiltroAtivo, setNotaFiltroAtivo] = useState("gerencia");
    const [mostrarModal, setMostrarModal] = useState(false);
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");
    const chavePersistencia = useMemo(
      () => `dashboard:estado:${String(usuarioLogado?.tipo || "anon").trim().toLowerCase()}:${idUsuarioLogado || "sem-id"}`,
      [usuarioLogado?.tipo, idUsuarioLogado]
    );
    function normalizarSelecaoPersistida(lista) {
      if (!Array.isArray(lista)) return [];
      return lista
        .map((item) => {
          const value = String(item?.value || "").trim();
          const label = String(item?.label || item?.value || "").trim();
          if (!value) return null;
          return { value, label: label || value };
        })
        .filter(Boolean);
    }

    function normalizarNome(valor) {
      return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    }

    function formatarDataLocalISO(data) {
      if (!(data instanceof Date) || Number.isNaN(data.getTime())) return "";
      const ano = data.getFullYear();
      const mes = String(data.getMonth() + 1).padStart(2, "0");
      const dia = String(data.getDate()).padStart(2, "0");
      return `${ano}-${mes}-${dia}`;
    }

    const nomeUsuarioLogado = normalizarNome(nomeUsuarioPerfilExibicao);

    useEffect(() => {
      try {
        const bruto = localStorage.getItem(chavePersistencia);
        if (!bruto) {
          setFiltrosRestaurados(true);
          return;
        }
        const salvo = JSON.parse(bruto);
        setFiltroCoord(normalizarSelecaoPersistida(salvo?.filtroCoord));
        setFiltroSetorMulti(normalizarSelecaoPersistida(salvo?.filtroSetorMulti));
        setFiltroSubsetor(normalizarSelecaoPersistida(salvo?.filtroSubsetor));
        setFiltroSupervisor(normalizarSelecaoPersistida(salvo?.filtroSupervisor));
        setFiltroFuncionario(normalizarSelecaoPersistida(salvo?.filtroFuncionario));
        setFiltroAtividade(normalizarSelecaoPersistida(salvo?.filtroAtividade));
        setFiltroDataInicio(String(salvo?.filtroDataInicio || ""));
        setFiltroDataFim(String(salvo?.filtroDataFim || ""));
        if (Number.isInteger(salvo?.graficoAtivo) && salvo.graficoAtivo >= 1 && salvo.graficoAtivo <= 7) {
          const graficoSalvo = salvo.graficoAtivo;
          if (graficoSalvo === 5 && !podeVerGraficoConcluidasPorDia) {
            setGraficoAtivo(1);
          } else if (graficoSalvo === 7 && !podeVerNotas) {
            setGraficoAtivo(1);
          } else {
            setGraficoAtivo(graficoSalvo);
          }
        }
        if (typeof salvo?.notaFiltroAtivo === "string" && salvo.notaFiltroAtivo.trim()) {
          setNotaFiltroAtivo(salvo.notaFiltroAtivo.trim());
        }
      } catch {
        // ignora estado persistido inválido
      } finally {
        setFiltrosRestaurados(true);
      }
    }, [chavePersistencia, podeVerGraficoConcluidasPorDia, podeVerNotas]);

    useEffect(() => {
      if (!podeVerGraficoConcluidasPorDia && graficoAtivo === 5) {
        setGraficoAtivo(1);
      }
    }, [podeVerGraficoConcluidasPorDia, graficoAtivo]);

    useEffect(() => {
      if (!podeVerNotas && graficoAtivo === 7) {
        setGraficoAtivo(1);
      }
    }, [podeVerNotas, graficoAtivo]);

    useEffect(() => {
      if (!filtrosRestaurados) return;
      const estado = {
        filtroCoord,
        filtroSetorMulti,
        filtroSubsetor,
        filtroSupervisor,
        filtroFuncionario,
        filtroAtividade,
        filtroDataInicio,
        filtroDataFim,
        graficoAtivo,
        notaFiltroAtivo
      };
      try {
        localStorage.setItem(chavePersistencia, JSON.stringify(estado));
      } catch {
        // ignora indisponibilidade do storage
      }
    }, [
      filtrosRestaurados,
      chavePersistencia,
      filtroCoord,
      filtroSetorMulti,
      filtroSubsetor,
      filtroSupervisor,
      filtroFuncionario,
      filtroAtividade,
      filtroDataInicio,
      filtroDataFim,
      graficoAtivo,
      notaFiltroAtivo
    ]);
    const atalhosPeriodo = useMemo(() => {
      const hoje = new Date();
      const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
      const fimHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999);
      const inicioOntem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
      const fimOntem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1, 23, 59, 59, 999);
      const inicioUltimos7 = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 6);
      const inicioMesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const fimMesAtual = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0, 23, 59, 59, 999);
      const inicioMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      const fimMesAnterior = new Date(hoje.getFullYear(), hoje.getMonth(), 0, 23, 59, 59, 999);

      return [
        { label: "Hoje", value: [inicioHoje, fimHoje] },
        { label: "Ontem", value: [inicioOntem, fimOntem] },
        { label: "Últimos 7 dias", value: [inicioUltimos7, fimHoje] },
        { label: "Mês atual", value: [inicioMesAtual, fimMesAtual] },
        { label: "Mês anterior", value: [inicioMesAnterior, fimMesAnterior] }
      ];
    }, []);
    // Estados para histórico de concluídas
    const [historicoConcluidas, setHistoricoConcluidas] = useState([]);

    const setorSupervisorLogado = useMemo(() => {
      if (!isSupervisor) return "";

      const setorVinculado = (setores || []).find((setor) => {
        const nomesSupervisores = Array.isArray(setor?.supervisor_nomes)
          ? setor.supervisor_nomes
          : Array.isArray(setor?.supervisores)
            ? setor.supervisores.map((supervisor) => supervisor?.nome)
            : setor?.supervisor_nome
              ? [setor.supervisor_nome]
              : [];

        return nomesSupervisores
          .map((nome) => String(nome || "").trim())
          .filter(Boolean)
          .some((nome) => normalizarNome(nome) === nomeUsuarioLogado) &&
          String(setor?.nome || "").trim();
      });

      return String(setorVinculado?.nome || "").trim();
    }, [isSupervisor, setores, nomeUsuarioLogado]);



    // ================= HISTÓRICO CONCLUÍDAS E AGRUPAMENTOS =================
    // Aplica ao histórico a mesma malha de filtros usada nos demais gráficos.
    const historicoFiltrado = useMemo(() => {
      return historicoConcluidas.filter((item) => {
        const dataHistorico = String(item?.data || "").split("T")[0];
        if (filtroDataInicio && dataHistorico < filtroDataInicio) return false;
        if (filtroDataFim && dataHistorico > filtroDataFim) return false;

        if (isCoordenador) {
          if (!nomeCoordenadorLogado) return false;
          if (item.coordenador_nome !== nomeCoordenadorLogado) return false;
        }

        if (isSupervisor) {
          if (!setorSupervisorLogado) return false;
          if (normalizarNome(item?.setor_nome) !== normalizarNome(setorSupervisorLogado)) return false;
        }

        if (isPadrao && normalizarNome(item?.funcionario_nome) !== nomeUsuarioLogado) return false;
        if (filtroCoord.length > 0 && !filtroCoord.some((f) => f.value === item.coordenador_nome)) return false;
        if (filtroSetorMulti.length > 0 && !filtroSetorMulti.some((f) => f.value === item.setor_nome)) return false;
        if (filtroSubsetor.length > 0 && !filtroSubsetor.some((f) => f.value === item.subsetor_nome)) return false;

        if (
          filtroSupervisor.length > 0 &&
          !filtroSupervisor.some((f) => normalizarNome(f.value) === normalizarNome(item.supervisor_nome))
        ) return false;

        if (
          filtroFuncionario.length > 0 &&
          !filtroFuncionario.some((f) => normalizarNome(f.value) === normalizarNome(item.funcionario_nome))
        ) return false;

        if (
          filtroAtividade.length > 0 &&
          !filtroAtividade.some((f) => normalizarNome(f.value) === normalizarNome(item.tarefa_nome))
        ) return false;

        return true;
      });
    }, [
      historicoConcluidas,
      filtroDataInicio,
      filtroDataFim,
      isCoordenador,
      nomeCoordenadorLogado,
      isSupervisor,
      setorSupervisorLogado,
      isPadrao,
      nomeUsuarioLogado,
      filtroCoord,
      filtroSetorMulti,
      filtroSubsetor,
      filtroSupervisor,
      filtroFuncionario,
      filtroAtividade
    ]);

    // Agrupar histórico filtrado por data para gráfico de área e calcular média por hora acumulada
    const dadosAreaConcluidas = useMemo(() => {
      const concluidasPorDia = {};
      const horasPorDia = {};

      historicoFiltrado.forEach((item) => {
        if (!item.data) return;
        const [data, hora] = item.data.split("T");
        concluidasPorDia[data] = (concluidasPorDia[data] || 0) + (Number(item.total_concluidas) || Number(item.total) || 1);
        if (hora) {
          if (!horasPorDia[data]) horasPorDia[data] = new Set();
          horasPorDia[data].add(hora.slice(0, 2));
        }
      });

      const sortedEntries = Object.entries(concluidasPorDia).sort((a, b) => new Date(a[0]) - new Date(b[0]));
      let somaAcumulada = 0;
      let horasAcumuladas = 0;

      return sortedEntries.map(([data, total]) => {
        somaAcumulada += total;
        const horasDia = horasPorDia[data] ? horasPorDia[data].size : 0;
        horasAcumuladas += horasDia;
        const mediaPorHora = horasAcumuladas > 0 ? somaAcumulada / horasAcumuladas : 0;
        return { data, total, mediaPorHora };
      });
    }, [historicoFiltrado]);

    // Drilldown: dados para gráficos
    // 1. Coordenações do dia
    const dadosCoordPorDia = useMemo(() => {
      if (!drilldownDia) return [];
      const porCoord = {};
      historicoFiltrado.forEach((item) => {
        if (!item.data) return;
        const data = item.data.split("T")[0];
        if (data !== drilldownDia) return;
        const coord = item.coordenador_nome || item.coordenador_id || "Sem Coordenação";
        porCoord[coord] = (porCoord[coord] || 0) + (Number(item.total_concluidas) || Number(item.total) || 1);
      });
      return Object.entries(porCoord).map(([nome, total]) => ({ nome, total }));
    }, [historicoFiltrado, drilldownDia]);
    // 2. Setores da coordenação
    const dadosSetorPorCoord = useMemo(() => {
      if (!drilldownDia || !drilldownCoord) return [];
      const porSetor = {};
      historicoFiltrado.forEach((item) => {
        if (!item.data) return;
        const data = item.data.split("T")[0];
        if (data !== drilldownDia) return;
        const coord = item.coordenador_nome || item.coordenador_id || "Sem Coordenação";
        if (coord !== drilldownCoord) return;
        const setor = item.setor_nome || item.setor_id || "Sem Setor";
        porSetor[setor] = (porSetor[setor] || 0) + (Number(item.total_concluidas) || Number(item.total) || 1);
      });
      return Object.entries(porSetor).map(([nome, total]) => ({ nome, total }));
    }, [historicoFiltrado, drilldownDia, drilldownCoord]);
    // 3. Subsetores do setor
    const dadosSubsetorPorSetor = useMemo(() => {
      if (!drilldownDia || !drilldownCoord || !drilldownSetor) return [];
      const porSubsetor = {};
      historicoFiltrado.forEach((item) => {
        if (!item.data) return;
        const data = item.data.split("T")[0];
        if (data !== drilldownDia) return;
        const coord = item.coordenador_nome || item.coordenador_id || "Sem Coordenação";
        if (coord !== drilldownCoord) return;
        const setor = item.setor_nome || item.setor_id || "Sem Setor";
        if (setor !== drilldownSetor) return;
        const subsetor = item.subsetor_nome || item.subsetor_id || "Sem Subsetor";
        porSubsetor[subsetor] = (porSubsetor[subsetor] || 0) + (Number(item.total_concluidas) || Number(item.total) || 1);
      });
      return Object.entries(porSubsetor).map(([nome, total]) => ({ nome, total }));
    }, [historicoFiltrado, drilldownDia, drilldownCoord, drilldownSetor]);

  // Agrupamentos dependentes do estado
  // Agrupa histórico por coordenador
  const historicoPorCoordenador = {};
  historicoFiltrado.forEach(item => {
    const coord = item.coordenador_nome || item.coordenador_id || 'Sem Coordenação';
    if (!historicoPorCoordenador[coord]) historicoPorCoordenador[coord] = 0;
    historicoPorCoordenador[coord] += Number(item.total_concluidas) || Number(item.total) || 0;
    });
  // eslint-disable-next-line no-unused-vars
  const dadosCoordenador = Object.entries(historicoPorCoordenador).map(([nome, total]) => ({ nome, total }));

  // Agrupa histórico por setor do coordenador selecionado
  let dadosSetorCoord = [];
  if (coordenadorSelecionado) {
    const setores = {};
    historicoFiltrado.forEach(item => {
      const coord = item.coordenador_nome || item.coordenador_id || 'Sem Coordenação';
      if (coord !== coordenadorSelecionado) return;
      const setor = item.setor_nome || item.setor_id || 'Sem Setor';
      setores[setor] = (setores[setor] || 0) + (Number(item.total_concluidas) || Number(item.total) || 0);
    });
    // eslint-disable-next-line no-unused-vars
    dadosSetorCoord = Object.entries(setores).map(([nome, total]) => ({ nome, total }));
  }

  // Agrupa histórico por subsetor do setor selecionado
  let dadosSubsetorSetor = [];
  if (setorSelecionado && coordenadorSelecionado) {
    const subsetores = {};
    historicoFiltrado.forEach(item => {
      const coord = item.coordenador_nome || item.coordenador_id || 'Sem Coordenação';
      const setor = item.setor_nome || item.setor_id || 'Sem Setor';
      if (coord !== coordenadorSelecionado || setor !== setorSelecionado) return;
      const subsetor = item.subsetor_nome || item.subsetor_id || 'Sem Subsetor';
      subsetores[subsetor] = (subsetores[subsetor] || 0) + (Number(item.total_concluidas) || Number(item.total) || 0);
    });
    // eslint-disable-next-line no-unused-vars
    dadosSubsetorSetor = Object.entries(subsetores).map(([nome, total]) => ({ nome, total }));
  }

  // const [historicoConcluidas, setHistoricoConcluidas] = useState([]); // Removido pois não é utilizado
  // const [diaSelecionado, setDiaSelecionado] = useState(null); // Removido: não utilizado


  

  const carregar = useCallback(async () => {
    const [registrosResp, tarefasResp, setoresResp, historicoResp, subsetoresResp] = await Promise.allSettled([
      api.get("/registros"),
      api.get("/tarefas"),
      api.get("/setores"),
      api.get("/tarefas/historico-concluidas"),
      api.get("/subsetores")
    ]);

    setRegistros(
      registrosResp.status === "fulfilled" && Array.isArray(registrosResp.value?.data)
        ? registrosResp.value.data
        : []
    );
    setTarefas(
      tarefasResp.status === "fulfilled" && Array.isArray(tarefasResp.value?.data)
        ? tarefasResp.value.data
        : []
    );
    setSetores(
      setoresResp.status === "fulfilled" && Array.isArray(setoresResp.value?.data)
        ? setoresResp.value.data
        : []
    );
    setSubsetores(
      subsetoresResp.status === "fulfilled" && Array.isArray(subsetoresResp.value?.data)
        ? subsetoresResp.value.data
        : []
    );
    setHistoricoConcluidas(
      historicoResp.status === "fulfilled" && Array.isArray(historicoResp.value?.data)
        ? historicoResp.value.data
        : []
    );
  }, []);



  useEffect(() => {
    carregar();
  }, [carregar]);

  const correspondeSelecao = useCallback((lista, valor) => {
    if (!Array.isArray(lista) || lista.length === 0) return true;
    const valorNormalizado = normalizarNome(valor);
    return lista.some((item) => normalizarNome(item?.value) === valorNormalizado);
  }, []);

  const extrairDataIsoRegistro = useCallback((valor) => {
    const dataIso = String(valor || "").split("T")[0];
    return /^\d{4}-\d{2}-\d{2}$/.test(dataIso) ? dataIso : "";
  }, []);

  const formatarDataIsoParaExibicao = useCallback((dataIso) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataIso || ""))) return "";
    const [ano, mes, dia] = dataIso.split("-");
    return `${dia}/${mes}/${ano}`;
  }, []);

  const dataNoIntervalo = useCallback((registro) => {
    const dataRegistro = extrairDataIsoRegistro(registro?.data_registro);
    if (!dataRegistro) return false;
    if (filtroDataInicio && dataRegistro < filtroDataInicio) return false;
    if (filtroDataFim && dataRegistro > filtroDataFim) return false;
    return true;
  }, [extrairDataIsoRegistro, filtroDataInicio, filtroDataFim]);

  function obterNomesSupervisoresDoSetor(setor) {
    if (Array.isArray(setor?.supervisor_nomes)) {
      return setor.supervisor_nomes
        .map((nome) => String(nome || "").trim())
        .filter(Boolean);
    }

    if (Array.isArray(setor?.supervisores)) {
      return setor.supervisores
        .map((supervisor) => String(supervisor?.nome || "").trim())
        .filter(Boolean);
    }

    if (setor?.supervisor_nome) {
      return [String(setor.supervisor_nome).trim()].filter(Boolean);
    }

    return [];
  }

  const registrosBaseParaOpcoes = useMemo(() => {
    return (registros || []).filter((registro) => {
      if (!dataNoIntervalo(registro)) return false;
      if (isCoordenador) {
        if (!nomeCoordenadorLogado) return false;
        if (registro.coordenador_nome !== nomeCoordenadorLogado) return false;
      }
      if (isSupervisor) {
        if (!setorSupervisorLogado) return false;
        if (normalizarNome(registro?.setor_nome) !== normalizarNome(setorSupervisorLogado)) return false;
      }
      return true;
    });
  }, [registros, dataNoIntervalo, isCoordenador, nomeCoordenadorLogado, isSupervisor, setorSupervisorLogado]);

  const criarOpcoesUnicas = useCallback((dados, chave) => {
    const vistos = new Set();
    return (dados || [])
      .map((item) => String(item?.[chave] || "").trim())
      .filter((valor) => {
        if (!valor) return false;
        if (vistos.has(valor)) return false;
        vistos.add(valor);
        return true;
      })
      .map((valor) => ({ value: valor, label: valor }));
  }, []);

  const filtrarParaOpcoes = useCallback((campoIgnorado) => {
    return registrosBaseParaOpcoes.filter((registro) => {
      if (campoIgnorado !== "coord" && !correspondeSelecao(filtroCoord, registro.coordenador_nome)) return false;
      if (campoIgnorado !== "setor" && !correspondeSelecao(filtroSetorMulti, registro.setor_nome)) return false;
      if (campoIgnorado !== "subsetor" && !correspondeSelecao(filtroSubsetor, registro.subsetor_nome)) return false;
      if (campoIgnorado !== "supervisor" && !correspondeSelecao(filtroSupervisor, registro.supervisor_nome)) return false;
      if (campoIgnorado !== "funcionario" && !correspondeSelecao(filtroFuncionario, registro.funcionario_nome)) return false;
      if (campoIgnorado !== "atividade" && !correspondeSelecao(filtroAtividade, registro.tarefa_nome)) return false;
      return true;
    });
  }, [registrosBaseParaOpcoes, correspondeSelecao, filtroCoord, filtroSetorMulti, filtroSubsetor, filtroSupervisor, filtroFuncionario, filtroAtividade]);

  const opcoesCoordFiltradas = useMemo(
    () => criarOpcoesUnicas(filtrarParaOpcoes("coord"), "coordenador_nome"),
    [criarOpcoesUnicas, filtrarParaOpcoes]
  );

  const opcoesSetorFiltradas = useMemo(
    () => criarOpcoesUnicas(filtrarParaOpcoes("setor"), "setor_nome"),
    [criarOpcoesUnicas, filtrarParaOpcoes]
  );

  const opcoesSubsetorFiltradas = useMemo(
    () => criarOpcoesUnicas(filtrarParaOpcoes("subsetor"), "subsetor_nome"),
    [criarOpcoesUnicas, filtrarParaOpcoes]
  );

  const opcoesSupervisorFiltradas = useMemo(
    () => criarOpcoesUnicas(filtrarParaOpcoes("supervisor"), "supervisor_nome"),
    [criarOpcoesUnicas, filtrarParaOpcoes]
  );

  const opcoesFuncionarioFiltradas = useMemo(
    () => criarOpcoesUnicas(filtrarParaOpcoes("funcionario"), "funcionario_nome"),
    [criarOpcoesUnicas, filtrarParaOpcoes]
  );

  const opcoesAtividadeFiltradas = useMemo(
    () => criarOpcoesUnicas(filtrarParaOpcoes("atividade"), "tarefa_nome"),
    [criarOpcoesUnicas, filtrarParaOpcoes]
  );

  function sincronizarSelecaoValida(atual, opcoes) {
    const validos = new Set((opcoes || []).map((item) => item.value));
    const filtrado = (atual || []).filter((item) => validos.has(item.value));
    const semMudanca =
      filtrado.length === (atual || []).length &&
      filtrado.every((item, indice) => item.value === atual[indice]?.value);
    return semMudanca ? atual : filtrado;
  }

  useEffect(() => {
    if (!filtrosRestaurados) return;
    if ((registros || []).length === 0) return;

    setFiltroCoord((atual) => sincronizarSelecaoValida(atual, opcoesCoordFiltradas));
    setFiltroSetorMulti((atual) => sincronizarSelecaoValida(atual, opcoesSetorFiltradas));
    setFiltroSubsetor((atual) => sincronizarSelecaoValida(atual, opcoesSubsetorFiltradas));
    setFiltroSupervisor((atual) => sincronizarSelecaoValida(atual, opcoesSupervisorFiltradas));
    if (!isPadrao) {
      setFiltroFuncionario((atual) => sincronizarSelecaoValida(atual, opcoesFuncionarioFiltradas));
    }
    setFiltroAtividade((atual) => sincronizarSelecaoValida(atual, opcoesAtividadeFiltradas));
  }, [
    opcoesCoordFiltradas,
    opcoesSetorFiltradas,
    opcoesSubsetorFiltradas,
    opcoesSupervisorFiltradas,
    opcoesFuncionarioFiltradas,
    opcoesAtividadeFiltradas,
    filtrosRestaurados,
    isSupervisor,
    isPadrao,
    registros
  ]);

  useEffect(() => {
    if (!isSupervisor) return;
    if (!setorSupervisorLogado) return;

    if (
      filtroSetorMulti.length !== 1 ||
      normalizarNome(filtroSetorMulti[0]?.value || "") !== normalizarNome(setorSupervisorLogado)
    ) {
      setFiltroSetorMulti([
        {
          value: setorSupervisorLogado,
          label: setorSupervisorLogado
        }
      ]);
    }
  }, [isSupervisor, setorSupervisorLogado, filtroSetorMulti]);

  useEffect(() => {
    if (!isSupervisor) return;
    if ((filtroSupervisor || []).length === 0) return;
    setFiltroSupervisor([]);
  }, [isSupervisor, filtroSupervisor]);

  useEffect(() => {
    if (!isPadrao) return;
    if (!nomeUsuarioPerfilExibicao) return;

    if (
      filtroFuncionario.length !== 1 ||
      normalizarNome(filtroFuncionario[0]?.value || "") !== nomeUsuarioLogado
    ) {
      setFiltroFuncionario([
        {
          value: nomeUsuarioPerfilExibicao,
          label: nomeUsuarioPerfilExibicao
        }
      ]);
    }
  }, [isPadrao, nomeUsuarioPerfilExibicao, nomeUsuarioLogado, filtroFuncionario]);

  // ================= FILTROS =================

  const registrosFiltrados = useMemo(() => {
    return registros.filter((r) => {
      const dataRegistro = String(r?.data_registro || "").split("T")[0];
      if (!dataRegistro) return false;
      if (filtroDataInicio && dataRegistro < filtroDataInicio) return false;
      if (filtroDataFim && dataRegistro > filtroDataFim) return false;
      if (isCoordenador) {
        if (!nomeCoordenadorLogado) return false;
        if (r.coordenador_nome !== nomeCoordenadorLogado) return false;
      }
      if (isSupervisor) {
        if (!setorSupervisorLogado) return false;
        if (normalizarNome(r.setor_nome) !== normalizarNome(setorSupervisorLogado)) return false;
      }
      if (isPadrao && normalizarNome(r.funcionario_nome) !== nomeUsuarioLogado) return false;
      if (filtroCoord.length > 0 && !filtroCoord.some((f) => f.value === r.coordenador_nome)) return false;
      if (filtroSetorMulti.length > 0 && !filtroSetorMulti.some((f) => f.value === r.setor_nome)) return false;
      if (filtroSubsetor.length > 0 && !filtroSubsetor.some((f) => f.value === r.subsetor_nome)) return false;
      if (
        filtroSupervisor.length > 0 &&
        !filtroSupervisor.some((f) => normalizarNome(f.value) === normalizarNome(r.supervisor_nome))
      ) return false;
      if (
        filtroFuncionario.length > 0 &&
        !filtroFuncionario.some((f) => normalizarNome(f.value) === normalizarNome(r.funcionario_nome))
      ) return false;
      if (
        filtroAtividade.length > 0 &&
        !filtroAtividade.some((f) => normalizarNome(f.value) === normalizarNome(r.tarefa_nome))
      ) return false;
      return true;
    });
  }, [
    registros,
    filtroDataInicio,
    filtroDataFim,
    isCoordenador,
    nomeCoordenadorLogado,
    isSupervisor,
    setorSupervisorLogado,
    isPadrao,
    nomeUsuarioLogado,
    filtroCoord,
    filtroSetorMulti,
    filtroSubsetor,
    filtroSupervisor,
    filtroFuncionario
    ,filtroAtividade
  ]);

  const tarefasBaseNotas = useMemo(() => {
    return tarefas.filter((tarefa) => {
      if (isCoordenador) {
        if (!nomeCoordenadorLogado) return false;
        if (tarefa.coordenador_nome !== nomeCoordenadorLogado) return false;
      }
      if (isSupervisor) {
        if (!setorSupervisorLogado) return false;
        if (normalizarNome(tarefa?.setor_nome) !== normalizarNome(setorSupervisorLogado)) return false;
      }
      if (isPadrao && normalizarNome(tarefa?.funcionario_nome) !== nomeUsuarioLogado) return false;
      if (filtroCoord.length > 0 && !filtroCoord.some((f) => f.value === tarefa.coordenador_nome)) return false;
      if (filtroSetorMulti.length > 0 && !filtroSetorMulti.some((f) => f.value === tarefa.setor_nome)) return false;
      if (filtroSubsetor.length > 0 && !filtroSubsetor.some((f) => f.value === tarefa.subsetor_nome)) return false;
      if (
        filtroSupervisor.length > 0 &&
        !filtroSupervisor.some((f) => normalizarNome(f.value) === normalizarNome(tarefa.supervisor_nome))
      ) return false;
      if (
        filtroFuncionario.length > 0 &&
        !filtroFuncionario.some((f) => normalizarNome(f.value) === normalizarNome(tarefa.funcionario_nome))
      ) return false;
      if (
        filtroAtividade.length > 0 &&
        !filtroAtividade.some((f) => normalizarNome(f.value) === normalizarNome(tarefa.nome))
      ) return false;
      return true;
    });
  }, [
    tarefas,
    isCoordenador,
    nomeCoordenadorLogado,
    isSupervisor,
    setorSupervisorLogado,
    isPadrao,
    nomeUsuarioLogado,
    filtroCoord,
    filtroSetorMulti,
    filtroSubsetor,
    filtroSupervisor,
    filtroFuncionario,
    filtroAtividade
  ]);

  const fontesBaseNotas = useMemo(
    () => [...tarefasBaseNotas, ...registrosFiltrados],
    [tarefasBaseNotas, registrosFiltrados]
  );
  
// const historicoFiltrado = ... (removido pois não é utilizado)
  // ================= AGRUPAMENTOS =================

  const agruparPor = useCallback((campo) => {
    const agrupado = {};
    registrosFiltrados.forEach((r) => {
      const chave = r[campo] || "Sem Informação";
      agrupado[chave] = (agrupado[chave] || 0) + 1;
    });
    return Object.keys(agrupado).map((k) => ({ nome: k, total: agrupado[k] }));
  }, [registrosFiltrados]);

  const agruparSetorComPorcentagem = useCallback(() => {
    const agrupado = {};
    registrosFiltrados.forEach((r) => {
      const nome = r.setor_nome || "Sem Informação";
      if (!agrupado[nome]) {
        agrupado[nome] = { nome, total: 0, somaPorcentagem: 0 };
      }
      agrupado[nome].total += 1;
      agrupado[nome].somaPorcentagem += Number(r.porcentagem || 0);
    });
    return Object.values(agrupado);
  }, [registrosFiltrados]);

  const agruparFuncionarioComPorcentagem = useCallback(() => {
    const agrupado = {};
    registrosFiltrados.forEach((r) => {
      const nome = r.funcionario_nome || "Sem Informação";
      if (!agrupado[nome]) {
        agrupado[nome] = { nome, total: 0, somaPorcentagem: 0 };
      }
      agrupado[nome].total += 1;
      agrupado[nome].somaPorcentagem += Number(r.porcentagem || 0);
    });
    return Object.values(agrupado);
  }, [registrosFiltrados]);

  const agruparAtividadeComPorcentagem = useCallback(() => {
    const agrupado = {};
    registrosFiltrados.forEach((r) => {
      const nome = r.tarefa_nome || "Sem Informação";
      if (!agrupado[nome]) {
        agrupado[nome] = { nome, total: 0, somaPorcentagem: 0 };
      }
      agrupado[nome].total += 1;
      agrupado[nome].somaPorcentagem += Number(r.porcentagem || 0);
    });
    return Object.values(agrupado);
  }, [registrosFiltrados]);

  const agruparPorPeriodo = useCallback(() => {
    const agrupado = {};
    registrosFiltrados.forEach((r) => {
      const dataIso = extrairDataIsoRegistro(r.data_registro);
      if (!dataIso) return;
      if (!agrupado[dataIso]) {
        agrupado[dataIso] = { dataIso, total: 0 };
      }
      agrupado[dataIso].total += 1;
    });

    return Object.values(agrupado)
      .sort((a, b) => a.dataIso.localeCompare(b.dataIso))
      .map(({ dataIso, total }) => ({ data: formatarDataIsoParaExibicao(dataIso), total }));
  }, [extrairDataIsoRegistro, formatarDataIsoParaExibicao, registrosFiltrados]);

  // const cores = [...] // Removido pois não é utilizado
    

  // Gera dados dos subsetores com soma das porcentagens
  const dadosSubsetorOrdenado = useMemo(() => {
    const dadosSubsetorRaw = agruparPor("subsetor_nome");
    const porcentagensPorSubsetor = {};
    registrosFiltrados.forEach((r) => {
      const nome = r.subsetor_nome || "Sem Informação";
      porcentagensPorSubsetor[nome] = (porcentagensPorSubsetor[nome] || 0) + Number(r.porcentagem || 0);
    });

    return dadosSubsetorRaw
      .map((item) => ({
        ...item,
        somaPorcentagem: porcentagensPorSubsetor[item.nome] || 0
      }))
      .sort((a, b) => {
        const diferencaPorcentagem = (Number(b.somaPorcentagem) || 0) - (Number(a.somaPorcentagem) || 0);
        if (diferencaPorcentagem !== 0) return diferencaPorcentagem;
        return (Number(b.total) || 0) - (Number(a.total) || 0);
      });
  }, [agruparPor, registrosFiltrados]);

  const dadosSetorOrdenado = useMemo(
    () => [...agruparSetorComPorcentagem()].sort((a, b) => b.total - a.total),
    [agruparSetorComPorcentagem]
  );
  const dadosFuncionarioOrdenado = useMemo(
    () => [...agruparFuncionarioComPorcentagem()].sort((a, b) => b.total - a.total),
    [agruparFuncionarioComPorcentagem]
  );
  const dadosAtividadeOrdenado = useMemo(() => {
    return [...agruparAtividadeComPorcentagem()].sort((a, b) => {
      const diferencaPorcentagem = (Number(b.somaPorcentagem) || 0) - (Number(a.somaPorcentagem) || 0);
      if (diferencaPorcentagem !== 0) return diferencaPorcentagem;
      return (Number(b.total) || 0) - (Number(a.total) || 0);
    });
  }, [agruparAtividadeComPorcentagem]);
  const resumirNomeAtividade = useCallback((nome) => {
    const texto = String(nome || "").trim();
    if (!texto) return "Sem Informação";

    const stopwords = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "por", "com", "na", "no", "nas", "nos"]);
    const palavras = texto
      .split(/\s+/)
      .map((palavra) => palavra.trim())
      .filter(Boolean);

    const palavrasRelevantes = palavras.filter((palavra) => !stopwords.has(palavra.toLowerCase()));
    const base = (palavrasRelevantes.length > 0 ? palavrasRelevantes : palavras).slice(0, 3).join(" ");

    if (!base) return "Sem Informação";
    return base.length >= texto.length ? base : `${base}...`;
  }, []);
  const dadosPeriodo = useMemo(() => agruparPorPeriodo(), [agruparPorPeriodo]);
  const totalRegistrosFiltrados = registrosFiltrados.length;
  const nomesBaseNotas = useMemo(() => {
    const coordenacoes = new Set();
    const setoresRegistros = new Set();
    const subsetoresRegistros = new Set();
    const funcionariosRegistros = new Set();

    (fontesBaseNotas || []).forEach((registro) => {
      const coordenacao = String(registro?.coordenador_nome || "").trim();
      const setor = String(registro?.setor_nome || "").trim();
      const subsetor = String(registro?.subsetor_nome || "").trim();
      const funcionario = String(registro?.funcionario_nome || registro?.nome_funcionario || "").trim();

      if (coordenacao) coordenacoes.add(coordenacao);
      if (setor) setoresRegistros.add(setor);
      if (subsetor) subsetoresRegistros.add(subsetor);
      if (funcionario) funcionariosRegistros.add(funcionario);
    });

    return {
      gerencia: GERENTES_DASHBOARD,
      coordenacao: Array.from(coordenacoes),
      setor: Array.from(setoresRegistros),
      subsetor: Array.from(subsetoresRegistros),
      funcionario: Array.from(funcionariosRegistros)
    };
  }, [fontesBaseNotas]);
  const agruparNotasPorCampo = useCallback((campo, nomesBase = [], vazio = "Sem Informação") => {
    const agrupado = {};

    (nomesBase || []).forEach((nome) => {
      const nomeFinal = String(nome || "").trim();
      if (!nomeFinal) return;
      agrupado[nomeFinal] = { nome: nomeFinal, total: 0, somaPorcentagem: 0 };
    });

    registrosFiltrados.forEach((registro) => {
      const nome = String(registro?.[campo] || "").trim() || vazio;
      if (!agrupado[nome]) {
        agrupado[nome] = { nome, total: 0, somaPorcentagem: 0 };
      }
      agrupado[nome].total += 1;
      agrupado[nome].somaPorcentagem += Number(registro?.porcentagem || 0);
    });

    return Object.values(agrupado)
      .map((item) => {
        const somaPorcentagem = Number(item?.somaPorcentagem || 0);
        const percentual = totalRegistrosFiltrados > 0
          ? Number(((Number(item?.total || 0) / totalRegistrosFiltrados) * 100).toFixed(1))
          : 0;
        const nota = Number(Math.max(0, Math.min(10, 10 - (somaPorcentagem / 10))).toFixed(1));

        return {
          ...item,
          percentual,
          nota
        };
      })
      .sort((a, b) => {
        const diferencaNota = (Number(b.nota) || 0) - (Number(a.nota) || 0);
        if (diferencaNota !== 0) return diferencaNota;
        return (Number(a.somaPorcentagem) || 0) - (Number(b.somaPorcentagem) || 0);
      });
  }, [registrosFiltrados, totalRegistrosFiltrados]);
  const dadosNotasSubsetor = useMemo(
    () => agruparNotasPorCampo("subsetor_nome", nomesBaseNotas.subsetor, "Sem Subsetor"),
    [agruparNotasPorCampo, nomesBaseNotas.subsetor]
  );
  const dadosNotasSetor = useMemo(() => {
    const notasPorSubsetor = new Map(
      dadosNotasSubsetor.map((item) => [String(item?.nome || "").trim(), item])
    );
    const setorParaSubsetores = {};

    (nomesBaseNotas.setor || []).forEach((nome) => {
      const nomeFinal = String(nome || "").trim();
      if (!nomeFinal) return;
      setorParaSubsetores[nomeFinal] = new Set();
    });

    (fontesBaseNotas || []).forEach((registro) => {
      const setorNome = String(registro?.setor_nome || "").trim();
      const subsetorNome = String(registro?.subsetor_nome || "").trim();
      if (!setorNome || !subsetorNome) return;

      if (!setorParaSubsetores[setorNome]) {
        setorParaSubsetores[setorNome] = new Set();
      }
      setorParaSubsetores[setorNome].add(subsetorNome);
    });

    return Object.entries(setorParaSubsetores)
      .map(([nome, subsetoresDoSetor]) => {
        const subsetoresRelacionados = Array.from(subsetoresDoSetor)
          .map((subsetorNome) => notasPorSubsetor.get(subsetorNome))
          .filter(Boolean);

        if (subsetoresRelacionados.length === 0) {
          return {
            nome,
            total: 0,
            percentual: 0,
            somaPorcentagem: 0,
            nota: 10
          };
        }

        const total = subsetoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.total) || 0), 0);
        const percentual = Number(
          subsetoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.percentual) || 0), 0).toFixed(1)
        );
        const somaPorcentagem = Number(
          subsetoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.somaPorcentagem) || 0), 0).toFixed(1)
        );
        const nota = Number(
          (
            subsetoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.nota) || 0), 0) /
            subsetoresRelacionados.length
          ).toFixed(1)
        );

        return {
          nome,
          total,
          percentual,
          somaPorcentagem,
          nota
        };
      })
      .sort((a, b) => {
        const diferencaNota = (Number(b.nota) || 0) - (Number(a.nota) || 0);
        if (diferencaNota !== 0) return diferencaNota;
        return (Number(a.somaPorcentagem) || 0) - (Number(b.somaPorcentagem) || 0);
      });
  }, [
    dadosNotasSubsetor,
    nomesBaseNotas.setor,
    fontesBaseNotas
  ]);
  const dadosNotasCoordenacao = useMemo(() => {
    const notasPorSetor = new Map(
      dadosNotasSetor.map((item) => [String(item?.nome || "").trim(), item])
    );
    const coordenacaoParaSetores = {};

    (nomesBaseNotas.coordenacao || []).forEach((nome) => {
      const nomeFinal = String(nome || "").trim();
      if (!nomeFinal) return;
      coordenacaoParaSetores[nomeFinal] = new Set();
    });

    (fontesBaseNotas || []).forEach((registro) => {
      const coordenadorNome = String(registro?.coordenador_nome || "").trim();
      const setorNome = String(registro?.setor_nome || "").trim();
      if (!coordenadorNome || !setorNome) return;

      if (!coordenacaoParaSetores[coordenadorNome]) {
        coordenacaoParaSetores[coordenadorNome] = new Set();
      }
      coordenacaoParaSetores[coordenadorNome].add(setorNome);
    });

    return Object.entries(coordenacaoParaSetores)
      .map(([nome, setoresDaCoordenacao]) => {
        const setoresRelacionados = Array.from(setoresDaCoordenacao)
          .map((setorNome) => notasPorSetor.get(setorNome))
          .filter(Boolean);

        if (setoresRelacionados.length === 0) {
          return {
            nome,
            total: 0,
            percentual: 0,
            somaPorcentagem: 0,
            nota: 10
          };
        }

        const total = setoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.total) || 0), 0);
        const percentual = Number(
          setoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.percentual) || 0), 0).toFixed(1)
        );
        const somaPorcentagem = Number(
          setoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.somaPorcentagem) || 0), 0).toFixed(1)
        );
        const nota = Number(
          (
            setoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.nota) || 0), 0) /
            setoresRelacionados.length
          ).toFixed(1)
        );

        return {
          nome,
          total,
          percentual,
          somaPorcentagem,
          nota
        };
      })
      .sort((a, b) => {
        const diferencaNota = (Number(b.nota) || 0) - (Number(a.nota) || 0);
        if (diferencaNota !== 0) return diferencaNota;
        return (Number(a.somaPorcentagem) || 0) - (Number(b.somaPorcentagem) || 0);
      });
  }, [
    dadosNotasSetor,
    nomesBaseNotas.coordenacao,
    fontesBaseNotas
  ]);
  const dadosNotasGerencia = useMemo(() => {
    const coordenadoresRelacionados = dadosNotasCoordenacao;

    const resumoCompartilhado = coordenadoresRelacionados.length === 0
      ? {
          total: 0,
          percentual: 0,
          somaPorcentagem: 0,
          nota: 10
        }
      : {
          total: coordenadoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.total) || 0), 0),
          percentual: Number(
            coordenadoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.percentual) || 0), 0).toFixed(1)
          ),
          somaPorcentagem: Number(
            coordenadoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.somaPorcentagem) || 0), 0).toFixed(1)
          ),
          nota: Number(
            (
              coordenadoresRelacionados.reduce((acumulado, item) => acumulado + (Number(item?.nota) || 0), 0) /
              coordenadoresRelacionados.length
            ).toFixed(1)
          )
        };

    return (nomesBaseNotas.gerencia || [])
      .map((nome) => ({
        nome,
        ...resumoCompartilhado
      }))
      .sort((a, b) => String(a.nome || "").localeCompare(String(b.nome || "")));
  }, [
    dadosNotasCoordenacao,
    nomesBaseNotas.gerencia
  ]);
  const dadosNotas = useMemo(() => ({
    gerencia: dadosNotasGerencia,
    coordenacao: dadosNotasCoordenacao,
    setor: dadosNotasSetor,
    subsetor: dadosNotasSubsetor,
    funcionario: agruparNotasPorCampo("funcionario_nome", nomesBaseNotas.funcionario, "Sem Funcionário")
  }), [agruparNotasPorCampo, dadosNotasGerencia, dadosNotasCoordenacao, dadosNotasSetor, dadosNotasSubsetor, nomesBaseNotas]);
  const configuracaoNotas = {
    gerencia: { titulo: "Notas por Gerência", cor: "#b91c1c" },
    coordenacao: { titulo: "Notas por Coordenação", cor: "#dc2626" },
    setor: { titulo: "Notas por Setor", cor: "#ef4444" },
    subsetor: { titulo: "Notas por Subsetor", cor: "#f87171" },
    funcionario: { titulo: "Notas por Funcionário", cor: "#fb7185" }
  };
  const dadosNotaAtiva = dadosNotas[notaFiltroAtivo] || [];
  const configNotaAtiva = configuracaoNotas[notaFiltroAtivo] || configuracaoNotas.gerencia;
  const totalRegistrosPeriodo = dadosPeriodo.reduce((acumulado, item) => acumulado + (Number(item?.total) || 0), 0);
  const totalConcluidasPeriodo = dadosAreaConcluidas.reduce((acumulado, item) => acumulado + (Number(item?.total) || 0), 0);
  const filtroPeriodoAtivo = Boolean(filtroDataInicio || filtroDataFim);
  const maxDatasVisiveis = 16;
  const intervaloDatasPeriodo = filtroPeriodoAtivo
    ? 0
    : Math.max(0, Math.ceil(dadosPeriodo.length / maxDatasVisiveis) - 1);
  const intervaloDatasConcluidas = filtroPeriodoAtivo
    ? 0
    : Math.max(0, Math.ceil(dadosAreaConcluidas.length / maxDatasVisiveis) - 1);
  const yMaxPeriodo = Math.max(1, ...dadosPeriodo.map((p) => Number(p?.total) || 0));
  const yMaxConcluidas = Math.max(
    1,
    ...dadosAreaConcluidas.map((p) => Math.max(Number(p?.total) || 0, Number(p?.mediaPorHora) || 0))
  );
  // const dadosGraficoConcluidas = formatarDadosGrafico(); // Removido pois não é utilizado

  // const totalSubsetor = dadosSubsetor.reduce((acc, item) => acc + item.total, 0); // Removido pois não é utilizado

  // ================= GERAR PDF =================

  async function gerarRelatorio() {
    // 1. Montar cabeçalho de filtros e data
    const dataGeracao = new Date();
    const dataFormatada = dataGeracao.toLocaleString();
    let filtros = [];
    if (filtroDataInicio || filtroDataFim) filtros.push(`Período: ${filtroDataInicio || '...'} até ${filtroDataFim || '...'}`);
    if (filtroCoord.length > 0) filtros.push(`Coordenação: ${filtroCoord.map(f => f.label).join(', ')}`);
    if (filtroSetorMulti.length > 0) filtros.push(`Setor: ${filtroSetorMulti.map(f => f.label).join(', ')}`);
    if (filtroSubsetor.length > 0) filtros.push(`Subsetor: ${filtroSubsetor.map(f => f.label).join(', ')}`);
    if (filtroSupervisor.length > 0) filtros.push(`Supervisor: ${filtroSupervisor.map(f => f.label).join(', ')}`);
    if (filtroFuncionario.length > 0) filtros.push(`Funcionário: ${filtroFuncionario.map(f => f.label).join(', ')}`);

    // 2. Renderizar todos os gráficos selecionados em container oculto
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.top = '-9999px';
    container.style.left = '-9999px';
    container.style.width = '1200px';
    container.style.background = '#fff';
    document.body.appendChild(container);

    // 3. Clonar e renderizar os gráficos selecionados
    for (const graficoId of graficosSelecionados) {
      const graficoOriginal = document.getElementById(graficoId);
      if (!graficoOriginal) continue;
      const clone = graficoOriginal.cloneNode(true);
      clone.style.marginBottom = '32px';
      container.appendChild(clone);
    }
    await new Promise(resolve => setTimeout(resolve, 100));

    // 4. Gerar PDF
    const pdf = new jsPDF("p", "mm", "a4");
    let y = 10;
    // Cabeçalho
    pdf.setFontSize(16);
    pdf.text("Relatório de Gráficos", 10, y);
    y += 10;
    pdf.setFontSize(10);
    pdf.text(`Gerado em: ${dataFormatada}`, 10, y);
    y += 7;
    if (filtros.length > 0) {
      pdf.text("Filtros aplicados:", 10, y);
      y += 6;
      filtros.forEach(f => {
        pdf.text(f, 10, y);
        y += 6;
    });
    }
    y += 4;

    // 5. Adicionar gráficos
    for (const graficoId of graficosSelecionados) {
      const el = container.querySelector(`#${graficoId}`);
      if (!el) continue;
      const canvas = await html2canvas(el, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      if (y + imgHeight > 280) {
        pdf.addPage();
        y = 10;
      }
      pdf.addImage(imgData, "PNG", 10, y, imgWidth, imgHeight);
      y += imgHeight + 10;
    }
    document.body.removeChild(container);
    pdf.save("relatorio-graficos.pdf");
  }

  // ================= RENDER =================

  // Container invisível para PDF
  const renderGraficosParaPDF = () => (
    <div id="pdf-container" style={{ position: 'absolute', left: '-9999px', top: 0, width: 1200, background: '#fff', zIndex: -1 }}>
      {graficosSelecionados.includes("grafico-impactos") && (
        <div id="grafico-impactos" style={{ marginBottom: 32 }}>
          {/* Maiores Impactos */}
          {dadosSubsetorOrdenado.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, dadosSubsetorOrdenado.length * 52)}>
              <BarChart
                data={dadosSubsetorOrdenado}
                layout="vertical"
                margin={{ top: 20, right: 90, left: 40, bottom: 0 }}
                barCategoryGap={40}
                barGap={0}
              >
                <XAxis type="number" />
                <YAxis
                  dataKey="nome"
                  type="category"
                  width={160}
                  tick={{ fontSize: 14, fill: '#222', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`} />
                <Bar dataKey="total" fill="#1e3a8a" barSize={18} radius={[6, 6, 6, 6]}>
                  <LabelList
                    position="right"
                    content={({ x, y, width, height, index }) => {
                      const item = dadosSubsetorOrdenado[index];
                      if (!item) return null;
                      return (
                        <text
                          x={x + width + 5}
                          y={y + height / 2}
                          fill="#1e3a8a"
                          dominantBaseline="middle"
                          fontSize={15}
                          fontWeight="bold"
                        >
                          {item.total}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="somaPorcentagem"
                  fill="#bcd2fa"
                  barSize={18}
                  radius={[6, 6, 6, 6]}
                  style={{ opacity: 1 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    position="right"
                    content={({ x, y, width, height, value }) => (
                      <text
                        x={x + width + 8}
                        y={y + height / 2}
                        fill="#111"
                        fontSize={15}
                        fontWeight="bold"
                        alignmentBaseline="middle"
                      >
                        {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                      </text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
          )}
        </div>
      )}
      {graficosSelecionados.includes("grafico-impactos-atividade") && (
        <div id="grafico-impactos-atividade" style={{ marginBottom: 32 }}>
          {/* Impactos por Atividade */}
          {dadosAtividadeOrdenado.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, dadosAtividadeOrdenado.length * 52)}>
              <BarChart
                data={dadosAtividadeOrdenado}
                layout="vertical"
                margin={{ top: 20, right: 90, left: 40, bottom: 0 }}
                barCategoryGap={40}
                barGap={0}
              >
                <XAxis type="number" />
                <YAxis
                  dataKey="nome"
                  type="category"
                  width={170}
                  tickFormatter={resumirNomeAtividade}
                  tick={{ fontSize: 14, fill: '#222', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  labelFormatter={(label) => `Atividade: ${label}`}
                  formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`}
                />
                <Bar dataKey="total" fill="#0f766e" barSize={18} radius={[6, 6, 6, 6]}>
                  <LabelList
                    position="right"
                    content={({ x, y, width, height, index }) => {
                      const item = dadosAtividadeOrdenado[index];
                      if (!item) return null;
                      return (
                        <text
                          x={x + width + 5}
                          y={y + height / 2}
                          fill="#0f766e"
                          dominantBaseline="middle"
                          fontSize={15}
                          fontWeight="bold"
                        >
                          {item.total}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="somaPorcentagem"
                  fill="#99f6e4"
                  barSize={18}
                  radius={[6, 6, 6, 6]}
                  style={{ opacity: 1 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    position="right"
                    content={({ x, y, width, height, value }) => (
                      <text
                        x={x + width + 8}
                        y={y + height / 2}
                        fill="#134e4a"
                        fontSize={15}
                        fontWeight="bold"
                        alignmentBaseline="middle"
                      >
                        {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                      </text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
          )}
        </div>
      )}
      {graficosSelecionados.includes("grafico-setor") && (
        <div id="grafico-setor" style={{ marginBottom: 32 }}>
          {/* Registros por Setor */}
          {dadosSetorOrdenado.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, dadosSetorOrdenado.length * 52)}>
              <BarChart
                data={dadosSetorOrdenado}
                layout="vertical"
                margin={{ top: 20, right: 90, left: 40, bottom: 0 }}
                barCategoryGap={40}
                barGap={0}
              >
                <XAxis type="number" />
                <YAxis
                  dataKey="nome"
                  type="category"
                  width={200}
                  tick={{ fontSize: 14, fill: '#222', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`} />
                <Bar dataKey="total" fill="#8e13be" barSize={18} radius={[6, 6, 6, 6]}>
                  <LabelList
                    position="right"
                    content={({ x, y, width, index }) => {
                      const item = dadosSetorOrdenado[index];
                      if (!item) return null;
                      return (
                        <text
                          x={x + width + 5}
                          y={y}
                          fill="#8e13be"
                          dominantBaseline="middle"
                          fontSize={15}
                          fontWeight="bold"
                        >
                          {item.total}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="somaPorcentagem"
                  fill="#f47678"
                  barSize={18}
                  radius={[6, 6, 6, 6]}
                  style={{ opacity: 1 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    position="right"
                    content={({ x, y, width, value }) => (
                      <text
                        x={x + width + 8}
                        y={y}
                        fill="#111"
                        fontSize={15}
                        fontWeight="bold"
                        alignmentBaseline="middle"
                      >
                        {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                      </text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
          )}
        </div>
      )}
      {graficosSelecionados.includes("grafico-funcionario") && (
        <div id="grafico-funcionario" style={{ marginBottom: 32 }}>
          {/* Registros por Funcionário */}
          {dadosFuncionarioOrdenado.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(220, 340, dadosFuncionarioOrdenado.length * 46)}>
              <BarChart
                data={dadosFuncionarioOrdenado}
                margin={{ top: 30, right: 60, left: 130, bottom: 80 }}
                barCategoryGap={54}
                barGap={8}
              >
                <XAxis
                  dataKey="nome"
                  type="category"
                  tick={{ fontSize: 13, angle: -60, textAnchor: 'end', fill: '#222', fontWeight: 600 }}
                  interval={0}
                  padding={{ left: 70, right: 30 }}
                />
                <YAxis type="number" />
                <Tooltip formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`} />
                <Bar dataKey="total" fill="#1E8E3E" barSize={18} radius={[6, 6, 6, 6]}>
                  <LabelList
                    position="top"
                    content={({ x, y, width, index }) => {
                      const item = dadosFuncionarioOrdenado[index];
                      if (!item) return null;
                      return (
                        <text
                          x={x + width / 2}
                          y={y - 8}
                          fill="#1E8E3E"
                          fontSize={15}
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {item.total}
                        </text>
                      );
                    }}
                  />
                </Bar>
                <Bar
                  dataKey="somaPorcentagem"
                  fill="#64f49b"
                  barSize={18}
                  radius={[6, 6, 6, 6]}
                  style={{ opacity: 1 }}
                  isAnimationActive={false}
                >
                  <LabelList
                    position="top"
                    content={({ x, y, width, value }) => (
                      <text
                        x={x + width / 2}
                        y={y - 8}
                        fill="#1E8E3E"
                        fontSize={15}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                      </text>
                    )}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
          )}
        </div>
      )}
      {graficosSelecionados.includes("grafico-periodo") && (
        <div id="grafico-periodo" style={{ marginBottom: 32 }}>
          {/* Registros por Período */}
          {dadosPeriodo.length > 0 ? (
            <>
              <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 700, width: "fit-content" }}>
                Total no período: {totalRegistrosPeriodo}
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={dadosPeriodo}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" interval={intervaloDatasPeriodo} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#C62828" />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
          )}
        </div>
      )}
    </div>
  );


return (
  <>
    {renderGraficosParaPDF()}
    {mostrarModal && (
      <div className="modal-overlay" onClick={() => setMostrarModal(false)}>
        <div
          className="modal-relatorio modal-md"
          onClick={(e) => e.stopPropagation()}
        >
          <h2>📄 Gerar Relatório</h2>
          <div className="modal-group">
            <label>Quais gráficos incluir?</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {[{ id: "grafico-impactos", label: "Maiores Impactos" }, { id: "grafico-impactos-atividade", label: "Impactos por Atividade" }, { id: "grafico-setor", label: "Registros por Setor" }, { id: "grafico-funcionario", label: "Registros por Funcionário" }, { id: "grafico-periodo", label: "Registros por Período" }].map(g => (
                <label key={g.id} style={{ fontWeight: 500 }}>
                  <input
                    type="checkbox"
                    checked={graficosSelecionados && graficosSelecionados.includes(g.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setGraficosSelecionados(prev => [...(prev || []), g.id]);
                      } else {
                        setGraficosSelecionados(prev => (prev || []).filter(id => id !== g.id));
                      }
                    }}
                  />
                  {" "}{g.label}
                </label>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button
              className="btn-confirmar"
              onClick={() => {
                gerarRelatorio();
                setMostrarModal(false);
              }}
            >
              Gerar PDF
            </button>
            <button
              className="btn-cancelar"
              onClick={() => setMostrarModal(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    <Layout>
      <div id="area-relatorio">
        {/* ================= BANNER ================= */}
        <div className="dashboard-banner"></div>

        {/* ================= CONTROLES ================= */}
        <div className="dashboard-unificado">
          <div className="top-dashboard-controls" style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0, marginBottom: 0}}>
            <div className="botoes-graficos" style={{display: 'flex', gap: 12, marginBottom: 6, flexWrap: isMobileView ? "nowrap" : "wrap", overflowX: isMobileView ? "auto" : "visible", width: "100%", paddingBottom: isMobileView ? 6 : 0}}>
              <button className={`btn-grafico ${graficoAtivo === 1 ? "ativo" : ""}`} onClick={() => setGraficoAtivo(1)}>Maiores Impactos</button>
              <button className={`btn-grafico ${graficoAtivo === 6 ? "ativo" : ""}`} onClick={() => setGraficoAtivo(6)}>Impactos por Atividade</button>
              <button className={`btn-grafico ${graficoAtivo === 2 ? "ativo" : ""}`} onClick={() => setGraficoAtivo(2)}>Registros por Setor</button>
              <button className={`btn-grafico ${graficoAtivo === 3 ? "ativo" : ""}`} onClick={() => setGraficoAtivo(3)}>Registros por Funcionário</button>
              <button className={`btn-grafico ${graficoAtivo === 4 ? "ativo" : ""}`} onClick={() => setGraficoAtivo(4)}>Registros por Período</button>
              <button
                className={`btn-grafico ${graficoAtivo === 5 ? "ativo" : ""}`}
                onClick={() => {
                  if (!podeVerGraficoConcluidasPorDia) {
                    alert("Você não tem permissão para acessar este gráfico.");
                    return;
                  }
                  setGraficoAtivo(5);
                }}
              >
                Concluídas por Dia (Setor)
              </button>
              {podeVerNotas && (
                <button
                  className={`btn-grafico btn-grafico-notas ${graficoAtivo === 7 ? "ativo" : ""}`}
                  onClick={() => setGraficoAtivo(7)}
                >
                  Relatório Gerencial
                </button>
              )}
              <button className="btn-grafico" onClick={() => setMostrarModal(true)}>
                Gerar Relatório PDF
              </button>
            </div>
            {podeVerNotas && graficoAtivo === 7 && (
              <div className="botoes-graficos botoes-graficos-notas">
                <button className={`btn-grafico btn-grafico-nota-sub ${notaFiltroAtivo === "gerencia" ? "ativo" : ""}`} onClick={() => setNotaFiltroAtivo("gerencia")}>Gerencia</button>
                <button className={`btn-grafico btn-grafico-nota-sub ${notaFiltroAtivo === "coordenacao" ? "ativo" : ""}`} onClick={() => setNotaFiltroAtivo("coordenacao")}>Coordenação</button>
                <button className={`btn-grafico btn-grafico-nota-sub ${notaFiltroAtivo === "setor" ? "ativo" : ""}`} onClick={() => setNotaFiltroAtivo("setor")}>Setor</button>
                <button className={`btn-grafico btn-grafico-nota-sub ${notaFiltroAtivo === "subsetor" ? "ativo" : ""}`} onClick={() => setNotaFiltroAtivo("subsetor")}>Subsetor</button>
                <button className={`btn-grafico btn-grafico-nota-sub ${notaFiltroAtivo === "funcionario" ? "ativo" : ""}`} onClick={() => setNotaFiltroAtivo("funcionario")}>Funcionário</button>
              </div>
            )}
            <div className="filtros-data" style={{ display: 'flex', flexDirection: isMobileView ? 'column' : 'row', alignItems: isMobileView ? 'stretch' : 'center', gap: 12, marginTop: 23, marginBottom: 38, marginLeft: isMobileView ? 0 : 2, width: '100%' }}>
              <DateRangePicker
                className="dash-date-range"
                style={{ width: isMobileView ? "100%" : 180 }}
                format="dd/MM/yyyy"
                placeholder="Selecionar período"
                cleanable
                ranges={atalhosPeriodo}
                onChange={(value) => {
                  if (value) {
                    setFiltroDataInicio(formatarDataLocalISO(value[0]));
                    setFiltroDataFim(formatarDataLocalISO(value[1]));
                  } else {
                    setFiltroDataInicio("");
                    setFiltroDataFim("");
                  }
                }}
              />
              <div style={{ minWidth: isMobileView ? "100%" : 160, width: isMobileView ? "100%" : 180 }}>
                <Select
                  className="dash-select"
                  classNamePrefix="dash-select"
                  isMulti
                  placeholder="Coordenação"
                  value={filtroCoord}
                  onChange={setFiltroCoord}
                  options={opcoesCoordFiltradas}
                  noOptionsMessage={() => "Sem opções disponíveis"}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  menuPortalTarget={portalTarget}
                  isDisabled={isCoordenador}
                />
              </div>
              <div style={{ minWidth: isMobileView ? "100%" : 160, width: isMobileView ? "100%" : 180 }}>
                <Select
                  className="dash-select"
                  classNamePrefix="dash-select"
                  isMulti
                  placeholder="Setor"
                  value={filtroSetorMulti}
                  onChange={setFiltroSetorMulti}
                  options={opcoesSetorFiltradas}
                  noOptionsMessage={() => "Sem opções disponíveis"}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  menuPortalTarget={portalTarget}
                  isDisabled={isSupervisor && !!setorSupervisorLogado}
                />
              </div>
              <div style={{ minWidth: isMobileView ? "100%" : 160, width: isMobileView ? "100%" : 180 }}>
                <Select
                  className="dash-select"
                  classNamePrefix="dash-select"
                  isMulti
                  placeholder="Subsetor"
                  value={filtroSubsetor}
                  onChange={setFiltroSubsetor}
                  options={opcoesSubsetorFiltradas}
                  noOptionsMessage={() => "Sem opções disponíveis"}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  menuPortalTarget={portalTarget}
                />
              </div>
              <div style={{ minWidth: isMobileView ? "100%" : 160, width: isMobileView ? "100%" : 180 }}>
                <Select
                  className="dash-select"
                  classNamePrefix="dash-select"
                  isMulti
                  placeholder="Supervisor"
                  value={filtroSupervisor}
                  onChange={setFiltroSupervisor}
                  options={opcoesSupervisorFiltradas}
                  noOptionsMessage={() => "Sem opções disponíveis"}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  menuPortalTarget={portalTarget}
                />
              </div>
              <div style={{ minWidth: isMobileView ? "100%" : 160, width: isMobileView ? "100%" : 180 }}>
                <Select
                  className="dash-select"
                  classNamePrefix="dash-select"
                  isMulti
                  placeholder="Funcionário"
                  value={filtroFuncionario}
                  onChange={setFiltroFuncionario}
                  options={opcoesFuncionarioFiltradas}
                  noOptionsMessage={() => "Sem opções disponíveis"}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  menuPortalTarget={portalTarget}
                  isDisabled={isPadrao}
                />
              </div>
              <div style={{ minWidth: isMobileView ? "100%" : 160, width: isMobileView ? "100%" : 180 }}>
                <Select
                  className="dash-select"
                  classNamePrefix="dash-select"
                  isMulti
                  placeholder="Atividade"
                  value={filtroAtividade}
                  onChange={setFiltroAtividade}
                  options={opcoesAtividadeFiltradas}
                  noOptionsMessage={() => "Sem opções disponíveis"}
                  styles={{ menuPortal: base => ({ ...base, zIndex: 9999 }) }}
                  menuPortalTarget={portalTarget}
                />
              </div>
            </div>
          </div>
          <div className="graficos-area">
            {/* Aqui continuam TODOS seus gráficos exatamente como estavam */}

       
        {/* ================= Barra coordenadores e drilldown ================= */}
        {podeVerGraficoConcluidasPorDia && graficoAtivo === 5 && (
          <div className="grafico-centralizado">
            {/* Drilldown: Subsetores do setor */}
            {drilldownDia && drilldownCoord && drilldownSetor && (
              <div style={{ width: "100%" }}>
                <button className="btn-voltar-drilldown" onClick={() => setDrilldownSetor(null)} style={{marginBottom: 8}}>← Voltar para setores</button>
                <h4 style={{marginBottom: 8}}>Subsetores de <b>{drilldownSetor}</b></h4>
                <ResponsiveContainer width="100%" height={isMobileView ? 430 : 390}>
                  <BarChart data={dadosSubsetorPorSetor} margin={{ top: 20, right: isMobileView ? 12 : 40, left: isMobileView ? 8 : 40, bottom: isMobileView ? 118 : 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" tick={{ angle: -35, textAnchor: 'end', fontSize: isMobileView ? 12 : 13, fontWeight: 600, fill: '#222' }} interval={0} height={isMobileView ? 118 : 90} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={v => `${v} concluídas`} />
                    <Bar dataKey="total" fill="#0f50db">
                      <LabelList dataKey="total" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Drilldown: Setores da coordenação */}
            {drilldownDia && drilldownCoord && !drilldownSetor && (
              <div style={{ width: "100%" }}>
                <button className="btn-voltar-drilldown" onClick={() => setDrilldownCoord(null)} style={{marginBottom: 8}}>← Voltar para coordenações</button>
                <h4 style={{marginBottom: 8}}>Setores de <b>{drilldownCoord}</b></h4>
                <ResponsiveContainer width="100%" height={isMobileView ? 430 : 390}>
                  <BarChart data={dadosSetorPorCoord} margin={{ top: 20, right: isMobileView ? 12 : 40, left: isMobileView ? 8 : 40, bottom: isMobileView ? 118 : 90 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" tick={{ angle: -35, textAnchor: "end", fontSize: isMobileView ? 12 : 13, fontWeight: 600, fill: "#222" }} interval={0} height={isMobileView ? 118 : 90} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={v => `${v} concluídas`} />
                    <Bar dataKey="total" fill="#0f50db" onClick={d => setDrilldownSetor(d.nome)} style={{cursor:'pointer'}}>
                      <LabelList dataKey="total" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Drilldown: Coordenações do dia */}
            {drilldownDia && !drilldownCoord && (
              <div style={{ width: "100%" }}>
                <button className="btn-voltar-drilldown" onClick={() => setDrilldownDia(null)} style={{marginBottom: 8}}>← Voltar para dias</button>
                <h4 style={{marginBottom: 8}}>Coordenações em <b>{drilldownDia}</b></h4>
                <ResponsiveContainer width="100%" height={isMobileView ? 430 : 390}>
                  <BarChart data={dadosCoordPorDia} margin={{ top: 20, right: isMobileView ? 12 : 40, left: isMobileView ? 8 : 40, bottom: isMobileView ? 118 : 90 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" tick={{ angle: -35, textAnchor: "end", fontSize: isMobileView ? 12 : 13, fontWeight: 600, fill: "#222" }} interval={0} height={isMobileView ? 118 : 90} />
                    <YAxis allowDecimals={false} />
                    <Tooltip formatter={v => `${v} concluídas`} />
                    <Bar dataKey="total" fill="#0f50db" onClick={d => setDrilldownCoord(d.nome)} style={{cursor:'pointer'}}>
                      <LabelList dataKey="total" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {/* Gráfico principal de área */}
            {!drilldownDia && dadosAreaConcluidas.length > 0 ? (
              <div style={{ width: "100%" }}>
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "#eff6ff", color: "#1d4ed8", fontWeight: 700, width: "fit-content", marginLeft: "auto", marginRight: "auto" }}>
                  Total concluídas no período: {totalConcluidasPeriodo}
                </div>
                <ResponsiveContainer width="100%" height={500}>
                  <AreaChart
                    data={dadosAreaConcluidas}
                    margin={{ top: 20, right: isMobileView ? 62 : 52, left: isMobileView ? 72 : 58, bottom: isMobileView ? 164 : 148 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="data"
                      tick={{ fontSize: isMobileView ? 12 : 13, fill: '#222', fontWeight: 600 }}
                      interval={intervaloDatasConcluidas}
                      angle={isMobileView ? -28 : -30}
                      textAnchor="end"
                      tickMargin={18}
                      minTickGap={16}
                      padding={{ left: 16, right: 16 }}
                      height={110}
                    />
                    <YAxis allowDecimals={false} domain={[0, yMaxConcluidas]} />
                    <Tooltip formatter={(v, name, item) => {
                      if (item?.dataKey === 'mediaPorHora') {
                        return `${Number(v || 0).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })} média/hora`;
                      }
                      return `${v} concluídas`;
                    }} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#0f50db"
                      fill="#bcd2fa"
                      strokeWidth={3}
                      activeDot={props => (
                        <circle
                          {...props}
                          r={7}
                          fill="#0f50db"
                          stroke="#fff"
                          strokeWidth={2}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setDrilldownDia(props.payload.data)}
                        />
                      )}
                    />
                    {/* Linha da média por hora acumulada */}
                    <Line type="linear" dataKey="mediaPorHora" stroke="#C62828" strokeDasharray="5 5" dot={false} name="Média acumulada por hora" />
                    <Legend verticalAlign="top" align="center" height={30} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            {!drilldownDia && dadosAreaConcluidas.length === 0 && (
              <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
            )}
          </div>
        )}

        {/* ================= MAIORES IMPACTOS ================= */}
        {graficoAtivo === 1 && (
          <div className="grafico-centralizado">
            {dadosSubsetorOrdenado.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(220, dadosSubsetorOrdenado.length * 52)}>
                <BarChart
                  data={dadosSubsetorOrdenado}
                  layout="vertical"
                  margin={{ top: 20, right: 90, left: 40, bottom: 0 }}
                  barCategoryGap={40}
                  barGap={0}
                >
                  <XAxis type="number" />
                  <YAxis
                    dataKey="nome"
                    type="category"
                    width={160}
                    tick={{ fontSize: 16, fill: '#222', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`} />
                  {/* Barra principal: número de registros */}
                  <Bar dataKey="total" fill="#1e3a8a" barSize={18} radius={[6, 6, 6, 6]}>
                    <LabelList
                      position="right"
                      content={({ x, y, width, height, index }) => {
                        const item = dadosSubsetorOrdenado[index];
                        if (!item) return null;
                        return (
                          <text
                            x={x + width + 5}
                            y={y + height / 2}
                            fill="#1e3a8a"
                            dominantBaseline="middle"
                            fontSize={16}
                            fontWeight="bold"
                          >
                            {item.total}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  {/* Barra de porcentagem: agrupada ao lado da principal */}
                  <Bar
                    dataKey="somaPorcentagem"
                    fill="#bcd2fa"
                    barSize={18}
                    radius={[6, 6, 6, 6]}
                    style={{ opacity: 1 }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="right"
                      content={({ x, y, width, height, value }) => (
                        <text
                          x={x + width + 8}
                          y={y + height / 2}
                          fill="#111"
                          fontSize={15}
                          fontWeight="bold"
                          alignmentBaseline="middle"
                        >
                          {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                        </text>
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
            )}
          </div>
        )}

        {/* ================= IMPACTOS POR ATIVIDADE ================= */}
        {graficoAtivo === 6 && (
          <div className="grafico-centralizado">
            {dadosAtividadeOrdenado.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(220, dadosAtividadeOrdenado.length * 52)}>
                <BarChart
                  data={dadosAtividadeOrdenado}
                  layout="vertical"
                  margin={{ top: 20, right: 90, left: 40, bottom: 0 }}
                  barCategoryGap={100}
                  barGap={0}
                >
                  <XAxis type="number" />
                  <YAxis
                    dataKey="nome"
                    type="category"
                    width={170}
                    tickFormatter={resumirNomeAtividade}
                    tick={{ fontSize: 16, fill: '#222', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    labelFormatter={(label) => `Atividade: ${label}`}
                    formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`}
                  />
                  <Bar dataKey="total" fill="#0f766e" barSize={18} radius={[6, 6, 6, 6]}>
                    <LabelList
                      position="right"
                      content={({ x, y, width, height, index }) => {
                        const item = dadosAtividadeOrdenado[index];
                        if (!item) return null;
                        return (
                          <text
                            x={x + width + 5}
                            y={y + height / 2}
                            fill="#0f766e"
                            dominantBaseline="middle"
                            fontSize={16}
                            fontWeight="bold"
                          >
                            {item.total}
                          </text>
                        );
                      }}
                    />
                  </Bar>
                  <Bar
                    dataKey="somaPorcentagem"
                    fill="#99f6e4"
                    barSize={18}
                    radius={[6, 6, 6, 6]}
                    style={{ opacity: 1 }}
                    isAnimationActive={false}
                  >
                    <LabelList
                      position="right"
                      content={({ x, y, width, height, value }) => (
                        <text
                          x={x + width + 8}
                          y={y + height / 2}
                          fill="#134e4a"
                          fontSize={15}
                          fontWeight="bold"
                          alignmentBaseline="middle"
                        >
                          {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                        </text>
                      )}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
            )}
          </div>
        )}

  
        
       {/* ================= BARRA SETOR ================= */}
        {graficoAtivo === 2 && (
  <div className="grafico-centralizado">
    {dadosSetorOrdenado.length > 0 ? (
      <ResponsiveContainer width="100%" height={Math.max(220, dadosSetorOrdenado.length * 52)}>
      <BarChart
        data={dadosSetorOrdenado}
        layout="vertical"
        margin={{ top: 20, right: 90, left: 40, bottom: 0 }}
        barCategoryGap={40}
        barGap={0}
      >
        <XAxis type="number" />
        <YAxis
          dataKey="nome"
          type="category"
          width={200}
          tick={{ fontSize: 18, fill: '#222', fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`} />
        {/* Barra principal: número de registros */}
        <Bar dataKey="total" fill="#8e13be" barSize={18} radius={[6, 6, 6, 6]}>
          <LabelList
            position="right"
            content={({ x, y, width, index }) => {
              const item = dadosSetorOrdenado[index];
              if (!item) return null;
              return (
                <text
                  x={x + width + 5}
                  y={y}
                  fill="#8e13be"
                  dominantBaseline="middle"
                  fontSize={16}
                  fontWeight="bold"
                >
                  {item.total}
                </text>
              );
            }}
          />
        </Bar>
        {/* Barra secundária: soma das porcentagens */}
        <Bar
          dataKey="somaPorcentagem"
          fill="#f47678"
          barSize={18}
          radius={[6, 6, 6, 6]}
          style={{ opacity: 1 }}
          isAnimationActive={false}
        >
          <LabelList
            position="right"
            content={({ x, y, width, value }) => (
              <text
                x={x + width + 8}
                y={y}
                fill="#111"
                fontSize={15}
                fontWeight="bold"
                alignmentBaseline="middle"
              >
                {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
              </text>
            )}
          />
        </Bar>
      </BarChart>
      </ResponsiveContainer>
    ) : (
      <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
    )}
  </div>
)}
        {/* ================= BARRA FUNCIONÁRIO ================= */}
         {graficoAtivo === 3 && (
  <div className="grafico-centralizado" style={{ width: '100%', overflowX: isMobileView ? 'hidden' : 'auto', paddingBottom: 10, display: 'block', textAlign: 'left' }}>
    {dadosFuncionarioOrdenado.length > 0 ? (
      <div style={{ minWidth: isMobileView ? "100%" : `${dadosFuncionarioOrdenado.length * 72 + 180}px`, maxWidth: 'none', display: 'inline-block', paddingLeft: isMobileView ? 0 : 20 }}>
        <ResponsiveContainer width={isMobileView ? "100%" : dadosFuncionarioOrdenado.length * 72 + 180} height={isMobileView ? 300 : Math.max(170, 340, dadosFuncionarioOrdenado.length * 46)}>
          <BarChart
            data={dadosFuncionarioOrdenado}
            margin={isMobileView ? { top: 20, right: 14, left: 14, bottom: 92 } : { top: 30, right: 50, left: 50, bottom: 120 }}
            barCategoryGap={24}
            barGap={10}
          >
            <XAxis
              dataKey="nome"
              type="category"
              tick={{ fontSize: isMobileView ? 11 : 15, angle: isMobileView ? -55 : -30, textAnchor: 'end', fill: '#222', fontWeight: 600 }}
              interval={0}
              height={isMobileView ? 86 : 110}
              padding={{ left: isMobileView ? 8 : 20, right: isMobileView ? 8 : 20 }}
            />
            <YAxis type="number" />
            <Tooltip formatter={(value, name) => name === 'total' ? `${value} registros` : `${value}%`} />
            {/* Barra principal: número de registros */}
            <Bar dataKey="total" fill="#1E8E3E" barSize={18} radius={[6, 6, 6, 6]}>
              <LabelList
                position="top"
                content={({ x, y, width, index }) => {
                  const item = dadosFuncionarioOrdenado[index];
                  if (!item) return null;
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 8}
                      fill="#1E8E3E"
                      fontSize={15}
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {item.total}
                    </text>
                  );
                }}
              />
            </Bar>
            {/* Barra de porcentagem: agrupada ao lado da principal */}
            <Bar
              dataKey="somaPorcentagem"
              fill="#64f49b"
              barSize={18}
              radius={[6, 6, 6, 6]}
              style={{ opacity: 1 }}
              isAnimationActive={false}
            >
              <LabelList
                position="top"
                content={({ x, y, width, value }) => (
                  <text
                    x={x + width / 2}
                    y={y - 8}
                    fill="#1E8E3E"
                    fontSize={15}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {Number(value).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%
                  </text>
                )}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    ) : (
      <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
    )}
  </div>
)}
        {/* ================= LINHA PERÍODO ================= */}
        {graficoAtivo === 4 && (
          dadosPeriodo.length > 0 ? (
            <>
              <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 700, width: "fit-content" }}>
                Total no período: {totalRegistrosPeriodo}
              </div>
              <ResponsiveContainer width="100%" height={500}>
                <LineChart
                  data={dadosPeriodo}
                  margin={{ top: 20, right: isMobileView ? 62 : 52, left: isMobileView ? 72 : 58, bottom: isMobileView ? 164 : 148 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="data"
                    tick={{
                      angle: isMobileView ? -28 : -35,
                      textAnchor: 'end',
                      fontSize: isMobileView ? 14 : 18,
                      fontWeight: 600,
                      fill: '#222'
                    }}
                    interval={intervaloDatasPeriodo}
                    height={isMobileView ? 116 : 104}
                    tickMargin={18}
                    minTickGap={16}
                    padding={{ left: 16, right: 16 }}
                  />
                  <YAxis domain={[0, yMaxPeriodo]} />
                  <Tooltip />
                  <Legend verticalAlign="top" align="center" height={30} />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#C62828"
                    activeDot={{ r: 7, fill: "#C62828", stroke: "#fff", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </>
          ) : (
            <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
          )
        )}
        {podeVerNotas && graficoAtivo === 7 && (
          <div className="grafico-centralizado">
            {dadosNotaAtiva.length > 0 ? (
              <div style={{ width: "100%" }}>
                <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 12, background: "#fef2f2", color: "#991b1b", fontWeight: 700, width: "fit-content" }}>
                  {configNotaAtiva.titulo} | Base de cálculo: {totalRegistrosFiltrados} registros
                </div>
                <ResponsiveContainer width="100%" height={Math.max(280, dadosNotaAtiva.length * 56)}>
                  <BarChart
                    data={dadosNotaAtiva}
                    layout="vertical"
                    margin={{ top: 20, right: 110, left: isMobileView ? 16 : 44, bottom: 0 }}
                    barCategoryGap={18}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 10]} />
                    <YAxis
                      dataKey="nome"
                      type="category"
                      width={isMobileView ? 130 : 210}
                      tick={{ fontSize: isMobileView ? 12 : 15, fill: "#222", fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "nota") return [`${value}`, "Nota"];
                        if (name === "somaPorcentagem") return [`${Number(value || 0).toFixed(1)}%`, "Soma das porcentagens"];
                        if (name === "percentual") return [`${value}%`, "% dos registros"];
                        return [`${value}`, "Registros"];
                      }}
                    />
                    <Bar dataKey="nota" fill={configNotaAtiva.cor} radius={[6, 6, 6, 6]}>
                      <LabelList
                        position="right"
                        formatter={(value) => `Nota ${Number(value || 0).toFixed(1)}`}
                      />
                    </Bar>
                    <Bar dataKey="somaPorcentagem" fill="#fecaca" hide />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 14, textAlign: "center", color: "#7f1d1d", fontSize: 14, fontWeight: 600 }}>
                  {notaFiltroAtivo === "gerencia"
                    ? "A nota da gerência é a média das notas dos coordenadores vinculados a ela."
                    : notaFiltroAtivo === "coordenacao"
                      ? "A nota da coordenação é a média das notas dos setores vinculados a ela."
                    : notaFiltroAtivo === "setor"
                      ? "A nota do setor é a média das notas dos subsetores vinculados a ele."
                    : "Nota = 10 - (soma das porcentagens / 10). O limite vai de 0 a 10; sem registro, a nota fica 10."}
                </div>
              </div>
            ) : (
              <div style={{textAlign: 'center', color: '#888', fontSize: 18, marginTop: 40}}>Sem dados para exibir</div>
            )}
          </div>
        )}
    </div>
        </div>

      </div>
    </Layout>
  </>
);
}






