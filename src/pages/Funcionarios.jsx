import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import Select from "react-select";
import api from "../services/api";
import Layout from "../components/Layout";
import Modal from "../components/Modal";
import { AuthContext } from "../context/AuthContext";

const ORDEM_TIPOS = ["DEVELOPER", "ADMIN", "COORDENADOR", "SUPERVISOR", "PADRAO"];
const PAPEIS_FUNCIONAIS_FIXOS = ["FUNCIONARIO", "SUPERVISOR", "COORDENADOR"];
const VALOR_NOVO_PAPEL = "__NOVO_PAPEL__";

function ehPapelFuncionalFixo(papel) {
  return PAPEIS_FUNCIONAIS_FIXOS.includes(String(papel || "").trim().toUpperCase());
}

function normalizarNome(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function formatarTipo(tipo) {
  const tipoNormalizado = String(tipo || "").trim().toUpperCase();
  if (tipoNormalizado === "PADRAO") return "PADRAO";
  return tipoNormalizado || "-";
}

function formatarPapel(papel) {
  const papelTexto = String(papel || "").trim();
  switch (papelTexto.toUpperCase()) {
    case "COORDENADOR":
      return "Coordenador";
    case "SUPERVISOR":
      return "Lider";
    case "FUNCIONARIO":
      return "Funcionario padrao";
    default:
      return papelTexto || "Funcionario padrao";
  }
}

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

function correspondeSelecao(lista, valorOuLista) {
  if (!Array.isArray(lista) || lista.length === 0) return true;

  const valores = Array.isArray(valorOuLista) ? valorOuLista : [valorOuLista];
  const valoresNormalizados = valores
    .map((valor) => normalizarNome(valor))
    .filter(Boolean);

  return lista.some((item) => valoresNormalizados.includes(normalizarNome(item?.value)));
}

function sincronizarSelecaoValida(atual, opcoes) {
  const validos = new Set((opcoes || []).map((item) => item.value));
  const filtrado = (atual || []).filter((item) => validos.has(item.value));
  const semMudanca =
    filtrado.length === (atual || []).length &&
    filtrado.every((item, indice) => item.value === atual[indice]?.value);

  return semMudanca ? atual : filtrado;
}

function ordenarTipos(a, b) {
  const indiceA = ORDEM_TIPOS.indexOf(a);
  const indiceB = ORDEM_TIPOS.indexOf(b);

  if (indiceA === -1 && indiceB === -1) {
    return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
  }
  if (indiceA === -1) return 1;
  if (indiceB === -1) return -1;
  return indiceA - indiceB;
}

function obterEstiloBadgeTipo(tipos) {
  if (!Array.isArray(tipos) || tipos.length !== 1) {
    return badgeMultiplo;
  }

  switch (String(tipos[0] || "").trim().toUpperCase()) {
    case "DEVELOPER":
      return badgeDeveloper;
    case "ADMIN":
      return badgeAdmin;
    case "COORDENADOR":
      return badgeCoordenadorLogin;
    case "SUPERVISOR":
      return badgeSupervisorLogin;
    default:
      return badgePadraoLogin;
  }
}

function obterEstiloBadgePapel(papel) {
  switch (String(papel || "").trim().toUpperCase()) {
    case "COORDENADOR":
      return badgeCoordenadorFuncional;
    case "SUPERVISOR":
      return badgeSupervisorFuncional;
    case "FUNCIONARIO":
      return badgeFuncionarioFuncional;
    default:
      return badgePapelCustomizado;
  }
}

function obterMensagemErro(err, fallback) {
  return err?.response?.data?.erro || err?.message || fallback;
}

function obterMensagemErroExclusao(err, registro) {
  const status = Number(err?.response?.status || 0);
  const erroApi = String(err?.response?.data?.erro || "").trim();
  const erroTecnico = String(err?.message || "").trim();
  const textoNormalizado = `${erroApi} ${erroTecnico}`.toLowerCase();
  const nome = String(registro?.nome || "este cadastro").trim();

  if (!err?.response) {
    return "Sem conexao com o servidor. Tente novamente em alguns instantes.";
  }

  if (status === 403) {
    return "Voce nao tem permissao para excluir este cadastro.";
  }

  if (status === 404) {
    return "Esse cadastro ja foi removido ou nao foi encontrado.";
  }

  if (
    textoNormalizado.includes("foreign key") ||
    textoNormalizado.includes("constraint") ||
    textoNormalizado.includes("violates")
  ) {
    return `Nao foi possivel excluir ${nome} porque ainda existem vinculacoes no sistema.`;
  }

  if (erroApi) {
    return `Nao foi possivel excluir ${nome}. Motivo: ${erroApi}`;
  }

  return "Erro ao excluir cadastro.";
}

function criarFormularioInicial(registro = null) {
  const papelAtual = String(registro?.papelFuncional || "FUNCIONARIO").trim() || "FUNCIONARIO";
  const papelEhFixo = ehPapelFuncionalFixo(papelAtual);

  return {
    nome: registro?.nome || "",
    papel: papelEhFixo ? papelAtual.toUpperCase() : VALOR_NOVO_PAPEL,
    papelCustomizado: papelEhFixo ? "" : papelAtual,
    possuiLogin: Boolean(registro?.usuarioId),
    usuario: registro?.usuarioLogin || "",
    senha: "",
    tipo: registro?.tipoPrincipal || "PADRAO"
  };
}

function resolverPapelFinal(form) {
  const tipoLogin = String(form?.tipo || "").trim().toUpperCase();
  if (form?.possuiLogin && (tipoLogin === "COORDENADOR" || tipoLogin === "SUPERVISOR")) {
    return tipoLogin;
  }

  const papelBruto =
    form?.papel === VALOR_NOVO_PAPEL ? form?.papelCustomizado : form?.papel;
  const papelTexto = String(papelBruto || "").trim();
  if (!papelTexto) return "FUNCIONARIO";

  return ehPapelFuncionalFixo(papelTexto) ? papelTexto.toUpperCase() : papelTexto;
}

function formatarDataAuditoria(valor) {
  if (!valor) return "Data nao informada";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "Data nao informada";

  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function obterTooltipAuditoria(registro) {
  const nomeAlterador = String(
    registro?.atualizadoPorNome || registro?.atualizadoPorLogin || ""
  ).trim();

  if (nomeAlterador || registro?.atualizadoEm) {
    return `Ultima alteracao por: ${nomeAlterador || "Nao informado"}\nData da alteracao: ${formatarDataAuditoria(
      registro?.atualizadoEm
    )}`;
  }

  const nomeCriador = String(
    registro?.criadoPorNome || registro?.criadoPorLogin || "Nao informado"
  ).trim();

  return `Criado por: ${nomeCriador || "Nao informado"}\nData: ${formatarDataAuditoria(
    registro?.criadoEm
  )}`;
}

export default function Funcionarios() {
  const [funcionarios, setFuncionarios] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [coordenadores, setCoordenadores] = useState([]);
  const [supervisores, setSupervisores] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(criarFormularioInicial());
  const [linhaSelecionada, setLinhaSelecionada] = useState(null);
  const [filtroNome, setFiltroNome] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState([]);
  const [filtroPapel, setFiltroPapel] = useState([]);
  const [estadoRestaurado, setEstadoRestaurado] = useState(false);

  const { token } = useContext(AuthContext);
  const usuarioLogado = useMemo(() => {
    if (!token) return null;

    try {
      return JSON.parse(atob(token.split(".")[1]));
    } catch {
      return null;
    }
  }, [token]);

  const tipoUsuarioLogado = String(usuarioLogado?.tipo || "").trim().toUpperCase();
  const isDeveloper = tipoUsuarioLogado === "DEVELOPER";
  const isAdmin = tipoUsuarioLogado === "ADMIN";
  const podeGerenciarFuncionarios = isAdmin || isDeveloper;
  const isEstrafiLogado =
    String(usuarioLogado?.usuario || "").trim().toLowerCase() === "estrafi";
  const idUsuarioLogado = String(usuarioLogado?.id || "").trim();
  const portalTarget = typeof document !== "undefined" ? document.body : null;
  const chavePersistencia = useMemo(
    () =>
      `funcionarios:estado:${String(usuarioLogado?.tipo || "anon")
        .trim()
        .toLowerCase()}:${idUsuarioLogado || "sem-id"}`,
    [usuarioLogado?.tipo, idUsuarioLogado]
  );

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(chavePersistencia);
      if (!bruto) {
        setEstadoRestaurado(true);
        return;
      }

      const salvo = JSON.parse(bruto);
      setFiltroNome(normalizarSelecaoPersistida(salvo?.filtroNome));
      setFiltroTipo(normalizarSelecaoPersistida(salvo?.filtroTipo));
      setFiltroPapel(normalizarSelecaoPersistida(salvo?.filtroPapel));
      if (salvo?.linhaSelecionada != null) {
        setLinhaSelecionada(salvo.linhaSelecionada);
      }
    } catch (err) {
      console.warn("Nao foi possivel restaurar o estado da aba de funcionarios.", err);
    } finally {
      setEstadoRestaurado(true);
    }
  }, [chavePersistencia]);

  useEffect(() => {
    if (!estadoRestaurado) return;

    try {
      localStorage.setItem(
        chavePersistencia,
        JSON.stringify({
          filtroNome,
          filtroTipo,
          filtroPapel,
          linhaSelecionada
        })
      );
    } catch (err) {
      console.warn("Nao foi possivel persistir o estado da aba de funcionarios.", err);
    }
  }, [estadoRestaurado, chavePersistencia, filtroNome, filtroTipo, filtroPapel, linhaSelecionada]);

  async function carregar() {
    try {
      const [funcionariosRes, usuariosRes, coordenadoresRes, supervisoresRes] = await Promise.all([
        api.get("/funcionarios"),
        api.get("/usuarios"),
        api.get("/coordenadores"),
        api.get("/supervisores")
      ]);

      setFuncionarios(Array.isArray(funcionariosRes?.data) ? funcionariosRes.data : []);
      setUsuarios(Array.isArray(usuariosRes?.data) ? usuariosRes.data : []);
      setCoordenadores(Array.isArray(coordenadoresRes?.data) ? coordenadoresRes.data : []);
      setSupervisores(Array.isArray(supervisoresRes?.data) ? supervisoresRes.data : []);
    } catch (err) {
      console.error(err);
      setFuncionarios([]);
      setUsuarios([]);
      setCoordenadores([]);
      setSupervisores([]);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const funcionariosComGestao = useMemo(() => {
    const mapa = new Map();

    function garantirItemBase(nome) {
      const nomeLimpo = String(nome || "").trim();
      const chave = normalizarNome(nomeLimpo);
      if (!chave) return null;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          nome: nomeLimpo,
          funcionarioId: null,
          coordenadorId: null,
          supervisorId: null,
          papelFuncionalCadastro: "FUNCIONARIO",
          usuariosDetalhes: [],
          tipos: new Set(),
          auditoria: {
            criadoPorNome: "",
            criadoPorLogin: "",
            criadoEm: null,
            atualizadoPorNome: "",
            atualizadoPorLogin: "",
            atualizadoEm: null
          }
        });
      }

      const item = mapa.get(chave);
      if (!item.nome && nomeLimpo) {
        item.nome = nomeLimpo;
      }

      return item;
    }

    (funcionarios || []).forEach((funcionario) => {
      const item = garantirItemBase(funcionario?.nome);
      if (!item) return;
      item.funcionarioId = funcionario?.id ? String(funcionario.id) : item.funcionarioId;
      item.papelFuncionalCadastro = String(funcionario?.papel_funcional || item.papelFuncionalCadastro || "FUNCIONARIO").trim() || "FUNCIONARIO";

      if (!item.auditoria.criadoPorNome && !item.auditoria.criadoPorLogin && !item.auditoria.criadoEm) {
        item.auditoria.criadoPorNome = String(funcionario?.criado_por_nome || "").trim();
        item.auditoria.criadoPorLogin = String(funcionario?.criado_por_login || "").trim();
        item.auditoria.criadoEm = funcionario?.criado_em || null;
      }

      if (!item.auditoria.atualizadoPorNome && !item.auditoria.atualizadoPorLogin && !item.auditoria.atualizadoEm) {
        item.auditoria.atualizadoPorNome = String(funcionario?.atualizado_por_nome || "").trim();
        item.auditoria.atualizadoPorLogin = String(funcionario?.atualizado_por_login || "").trim();
        item.auditoria.atualizadoEm = funcionario?.atualizado_em || null;
      }
    });

    (coordenadores || []).forEach((coordenador) => {
      const item = garantirItemBase(coordenador?.nome);
      if (!item) return;
      item.coordenadorId = coordenador?.id ? String(coordenador.id) : item.coordenadorId;
    });

    (supervisores || []).forEach((supervisor) => {
      const item = garantirItemBase(supervisor?.nome);
      if (!item) return;
      item.supervisorId = supervisor?.id ? String(supervisor.id) : item.supervisorId;
    });

    (usuarios || []).forEach((usuario) => {
      const item = garantirItemBase(usuario?.nome);
      if (!item) return;

      const id = String(usuario?.id || "").trim();
      const jaExiste = item.usuariosDetalhes.some((registro) => registro.id === id);
      if (!jaExiste && id) {
        item.usuariosDetalhes.push({
          id,
          usuario: String(usuario?.usuario || "").trim(),
          tipo: String(usuario?.tipo || "").trim().toUpperCase()
        });
      }

      const tipo = String(usuario?.tipo || "").trim().toUpperCase();
      if (tipo) {
        item.tipos.add(tipo);
      }
    });

    return Array.from(mapa.values())
      .map((item) => {
        const tiposBrutos = Array.from(item.tipos).sort(ordenarTipos);
        const usuarioPrincipal = item.usuariosDetalhes[0] || null;
        const papelFuncional = item.coordenadorId
          ? "COORDENADOR"
          : item.supervisorId
            ? "SUPERVISOR"
            : item.papelFuncionalCadastro || "FUNCIONARIO";

        return {
          id: item.funcionarioId || item.coordenadorId || item.supervisorId || usuarioPrincipal?.id || item.chave,
          funcionarioId: item.funcionarioId,
          coordenadorId: item.coordenadorId,
          supervisorId: item.supervisorId,
          usuarioId: usuarioPrincipal?.id || null,
          usuarioLogin: usuarioPrincipal?.usuario || "",
          tipoPrincipal: usuarioPrincipal?.tipo || "",
          possuiLogin: item.usuariosDetalhes.length > 0,
          nome: item.nome,
          tiposBrutos,
          tipoLabel: tiposBrutos.length > 0 ? tiposBrutos.map(formatarTipo).join(", ") : "",
          papelFuncional,
          papelLabel: formatarPapel(papelFuncional),
          criadoPorNome: item.auditoria.criadoPorNome,
          criadoPorLogin: item.auditoria.criadoPorLogin,
          criadoEm: item.auditoria.criadoEm,
          atualizadoPorNome: item.auditoria.atualizadoPorNome,
          atualizadoPorLogin: item.auditoria.atualizadoPorLogin,
          atualizadoEm: item.auditoria.atualizadoEm,
          podeExcluir: Boolean(
            item.funcionarioId || item.coordenadorId || item.supervisorId || usuarioPrincipal?.id
          )
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
  }, [funcionarios, usuarios, coordenadores, supervisores]);

  function criarOpcoesNome(dados) {
    const vistos = new Set();
    return (dados || [])
      .map((item) => String(item?.nome || "").trim())
      .filter((nomeItem) => {
        if (!nomeItem) return false;
        const chave = normalizarNome(nomeItem);
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }))
      .map((valor) => ({ value: valor, label: valor }));
  }

  function criarOpcoesTipo(dados) {
    const vistos = new Set();
    return (dados || [])
      .flatMap((item) => item?.tiposBrutos || [])
      .filter((tipo) => {
        const tipoNormalizado = String(tipo || "").trim().toUpperCase();
        if (!tipoNormalizado) return false;
        if (vistos.has(tipoNormalizado)) return false;
        vistos.add(tipoNormalizado);
        return true;
      })
      .sort(ordenarTipos)
      .map((tipo) => ({
        value: tipo,
        label: formatarTipo(tipo)
      }));
  }

  function criarOpcoesPapel(dados) {
    const vistos = new Set();
    return (dados || [])
      .map((item) => String(item?.papelFuncional || "").trim())
      .filter((papelItem) => {
        if (!papelItem) return false;
        const chave = normalizarNome(papelItem);
        if (vistos.has(chave)) return false;
        vistos.add(chave);
        return true;
      })
      .sort((a, b) => {
        const aNormalizado = String(a || "").trim().toUpperCase();
        const bNormalizado = String(b || "").trim().toUpperCase();
        const indiceA = PAPEIS_FUNCIONAIS_FIXOS.indexOf(aNormalizado);
        const indiceB = PAPEIS_FUNCIONAIS_FIXOS.indexOf(bNormalizado);

        if (indiceA !== -1 && indiceB !== -1) return indiceA - indiceB;
        if (indiceA !== -1) return -1;
        if (indiceB !== -1) return 1;
        return String(a).localeCompare(String(b), "pt-BR", { sensitivity: "base" });
      })
      .map((papelItem) => ({
        value: papelItem,
        label: formatarPapel(papelItem)
      }));
  }

  const filtrarParaOpcoes = useCallback((campoIgnorado) => {
    return funcionariosComGestao.filter((item) => {
      if (campoIgnorado !== "nome" && !correspondeSelecao(filtroNome, item.nome)) return false;
      if (campoIgnorado !== "tipo" && !correspondeSelecao(filtroTipo, item.tiposBrutos)) return false;
      if (campoIgnorado !== "papel" && !correspondeSelecao(filtroPapel, item.papelFuncional)) return false;
      return true;
    });
  }, [funcionariosComGestao, filtroNome, filtroTipo, filtroPapel]);

  const opcoesNomeFiltradas = useMemo(
    () => criarOpcoesNome(filtrarParaOpcoes("nome")),
    [filtrarParaOpcoes]
  );

  const opcoesTipoFiltradas = useMemo(
    () => criarOpcoesTipo(filtrarParaOpcoes("tipo")),
    [filtrarParaOpcoes]
  );

  const opcoesPapelFiltradas = useMemo(
    () => criarOpcoesPapel(filtrarParaOpcoes("papel")),
    [filtrarParaOpcoes]
  );

  useEffect(() => {
    if (!estadoRestaurado) return;

    setFiltroNome((atual) => sincronizarSelecaoValida(atual, opcoesNomeFiltradas));
    setFiltroTipo((atual) => sincronizarSelecaoValida(atual, opcoesTipoFiltradas));
    setFiltroPapel((atual) => sincronizarSelecaoValida(atual, opcoesPapelFiltradas));
  }, [estadoRestaurado, opcoesNomeFiltradas, opcoesTipoFiltradas, opcoesPapelFiltradas]);

  const funcionariosFiltrados = useMemo(() => {
    return funcionariosComGestao.filter((item) => {
      if (!correspondeSelecao(filtroNome, item.nome)) return false;
      if (!correspondeSelecao(filtroTipo, item.tiposBrutos)) return false;
      if (!correspondeSelecao(filtroPapel, item.papelFuncional)) return false;
      return true;
    });
  }, [funcionariosComGestao, filtroNome, filtroTipo, filtroPapel]);

  function abrirNovo() {
    setEditando(null);
    setForm(criarFormularioInicial());
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditando(null);
    setForm(criarFormularioInicial());
  }

  function abrirEditar(registro) {
    const tipoAlvo = String(registro?.tipoPrincipal || "").trim().toUpperCase();
    if (tipoAlvo === "DEVELOPER" && !isDeveloper) {
      alert("Apenas DEVELOPER pode editar usuarios DEVELOPER.");
      return;
    }

    setEditando(registro);
    setForm(criarFormularioInicial(registro));
    setModalOpen(true);
  }

  function atualizarFormulario(campo, valor) {
    setForm((atual) => ({
      ...atual,
      [campo]: valor
    }));
  }

  function atualizarTipoLogin(valor) {
    const tipoFinal = String(valor || "PADRAO").trim().toUpperCase();
    setForm((atual) => ({
      ...atual,
      tipo: tipoFinal,
      papel:
        tipoFinal === "COORDENADOR" || tipoFinal === "SUPERVISOR"
          ? tipoFinal
          : atual.papel
    }));
  }

  async function sincronizarPapelFuncional(registroAtual, nomeFinal, papelFinal) {
    const coordenadorId = registroAtual?.coordenadorId || null;
    const supervisorId = registroAtual?.supervisorId || null;

    if (papelFinal === "COORDENADOR") {
      if (coordenadorId) {
        await api.put(`/coordenadores/${coordenadorId}`, { nome: nomeFinal });
      } else {
        await api.post("/coordenadores", { nome: nomeFinal });
      }

      if (supervisorId) {
        await api.delete(`/supervisores/${supervisorId}`);
      }
      return;
    }

    if (papelFinal === "SUPERVISOR") {
      if (supervisorId) {
        await api.put(`/supervisores/${supervisorId}`, { nome: nomeFinal });
      } else {
        await api.post("/supervisores", { nome: nomeFinal });
      }

      if (coordenadorId) {
        await api.delete(`/coordenadores/${coordenadorId}`);
      }
      return;
    }

    if (coordenadorId) {
      await api.delete(`/coordenadores/${coordenadorId}`);
    }

    if (supervisorId) {
      await api.delete(`/supervisores/${supervisorId}`);
    }
  }

  async function sincronizarLogin(registroAtual, payload) {
    const usuarioId = registroAtual?.usuarioId || null;
    const tipoDestino = String(payload?.tipo || "").trim().toUpperCase();

    if (!payload?.possuiLogin) {
      if (usuarioId) {
        await api.delete(`/usuarios/${usuarioId}`);
      }
      return;
    }

    if (usuarioId) {
      const payloadAtualizacao = {
        nome: payload.nome,
        usuario: payload.usuario,
        tipo: tipoDestino
      };

      if (String(payload?.senha || "").trim()) {
        payloadAtualizacao.senha = String(payload.senha);
      }

      await api.put(`/usuarios/${usuarioId}`, payloadAtualizacao);
      return;
    }

    await api.post("/usuarios", {
      nome: payload.nome,
      usuario: payload.usuario,
      senha: payload.senha,
      tipo: tipoDestino
    });
  }

  function validarPermissoesLogin(registroAtual, payload) {
    const tipoDestino = String(payload?.tipo || "").trim().toUpperCase();
    const tipoAtual = String(registroAtual?.tipoPrincipal || "").trim().toUpperCase();
    const editandoEhProprioUsuario =
      registroAtual &&
      String(registroAtual?.usuarioId || "").trim() === String(usuarioLogado?.id || "").trim();
    const podePromoverParaDeveloper = isDeveloper || (isEstrafiLogado && editandoEhProprioUsuario);

    if (payload?.possuiLogin && tipoDestino === "DEVELOPER" && !podePromoverParaDeveloper) {
      throw new Error("Apenas DEVELOPER pode criar ou editar usuarios DEVELOPER.");
    }

    if (registroAtual?.usuarioId && tipoAtual === "DEVELOPER" && !isDeveloper) {
      throw new Error("Apenas DEVELOPER pode editar usuarios DEVELOPER.");
    }
  }

  async function salvar() {
    const nomeLimpo = String(form?.nome || "").trim();
    const possuiLogin = Boolean(form?.possuiLogin);
    const tipoFinal = String(form?.tipo || "PADRAO").trim().toUpperCase();
    const papelFinal = resolverPapelFinal(form);
    const nomeDuplicado = funcionariosComGestao.some(
      (item) =>
        normalizarNome(item?.nome) === normalizarNome(nomeLimpo) &&
        String(item?.id || "") !== String(editando?.id || "")
    );

    if (!nomeLimpo) {
      alert("Preencha o nome do funcionario.");
      return;
    }

    if (form?.papel === VALOR_NOVO_PAPEL && !String(form?.papelCustomizado || "").trim()) {
      alert("Informe o nome do novo papel funcional.");
      return;
    }

    if (nomeDuplicado) {
      alert("Funcionario ja cadastrado no sistema");
      return;
    }

    if (possuiLogin && !editando?.usuarioId && !String(form?.usuario || "").trim()) {
      alert("Preencha o usuario de login.");
      return;
    }

    if (possuiLogin && editando?.usuarioId && !String(form?.usuario || "").trim()) {
      alert("Preencha o usuario de login.");
      return;
    }

    if (possuiLogin && !editando?.usuarioId && !String(form?.senha || "").trim()) {
      alert("Preencha a senha de login.");
      return;
    }

    try {
      validarPermissoesLogin(editando, {
        possuiLogin,
        tipo: tipoFinal
      });

      if (editando?.funcionarioId) {
        await api.put(`/funcionarios/${editando.funcionarioId}`, {
          nome: nomeLimpo,
          papel_funcional: papelFinal
        });
      } else {
        await api.post("/funcionarios", {
          nome: nomeLimpo,
          papel_funcional: papelFinal
        });
      }

      await sincronizarPapelFuncional(editando, nomeLimpo, papelFinal);
      await sincronizarLogin(editando, {
        possuiLogin,
        nome: nomeLimpo,
        usuario: String(form?.usuario || "").trim(),
        senha: String(form?.senha || "").trim(),
        tipo: tipoFinal
      });

      await carregar();
      fecharModal();
    } catch (err) {
      console.error(err);
      alert(obterMensagemErro(err, "Erro ao salvar cadastro."));
    }
  }

  async function deletar(registro) {
    const tipoAlvo = String(registro?.tipoPrincipal || "").trim().toUpperCase();
    if (tipoAlvo === "DEVELOPER" && !isDeveloper) {
      alert("Apenas DEVELOPER pode excluir usuarios DEVELOPER.");
      return;
    }

    if (!registro?.podeExcluir) {
      alert("Esse nome nao possui cadastro gerenciavel na aba de funcionarios.");
      return;
    }

    if (!window.confirm(`Deseja excluir o cadastro de "${registro.nome}"?`)) {
      return;
    }

    try {
      if (registro.coordenadorId) {
        await api.delete(`/coordenadores/${registro.coordenadorId}`);
      }

      if (registro.supervisorId) {
        await api.delete(`/supervisores/${registro.supervisorId}`);
      }

      if (registro.funcionarioId) {
        await api.delete(`/funcionarios/${registro.funcionarioId}`);
      }

      if (registro.usuarioId) {
        await api.delete(`/usuarios/${registro.usuarioId}`);
      }

      await carregar();
      setLinhaSelecionada((atual) => (atual === registro.id ? null : atual));
    } catch (err) {
      console.error(err);
      alert(obterMensagemErroExclusao(err, registro));
    }
  }

  return (
    <Layout>
      <div className="funcionarios-page">
      <h1 style={{ color: "#0047AB", marginBottom: "8px" }}>
        {"Gestao de Funcionarios"}
      </h1>

      <p style={descricao}>
        {"Essa aba centraliza o cadastro funcional e o acesso ao sistema. Aqui voce consegue manter funcionario, lider, coordenador e tambem criar, editar ou remover login."}
      </p>

      <div className="app-filter-bar" style={cardFiltro}>
        <Select
          className="app-filter-select"
          classNamePrefix="app-filter-select"
          placeholder={"Filtrar por funcionario"}
          isMulti
          closeMenuOnSelect={false}
          value={filtroNome}
          onChange={(selecionado) => setFiltroNome(selecionado || [])}
          options={opcoesNomeFiltradas}
          noOptionsMessage={() => "Sem funcionarios"}
          menuPortalTarget={portalTarget}
          menuPosition="fixed"
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 9999 })
          }}
        />

        <Select
          className="app-filter-select"
          classNamePrefix="app-filter-select"
          placeholder="Filtrar por tipo de login"
          isMulti
          closeMenuOnSelect={false}
          value={filtroTipo}
          onChange={(selecionado) => setFiltroTipo(selecionado || [])}
          options={opcoesTipoFiltradas}
          noOptionsMessage={() => "Sem tipos"}
          menuPortalTarget={portalTarget}
          menuPosition="fixed"
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 9999 })
          }}
        />

        <Select
          className="app-filter-select"
          classNamePrefix="app-filter-select"
          placeholder="Filtrar por papel"
          isMulti
          closeMenuOnSelect={false}
          value={filtroPapel}
          onChange={(selecionado) => setFiltroPapel(selecionado || [])}
          options={opcoesPapelFiltradas}
          noOptionsMessage={() => "Sem papeis"}
          menuPortalTarget={portalTarget}
          menuPosition="fixed"
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 9999 })
          }}
        />

        <button
          style={btnSecundario}
          onClick={() => {
            setFiltroNome([]);
            setFiltroTipo([]);
            setFiltroPapel([]);
          }}
        >
          Limpar Filtros
        </button>

        {podeGerenciarFuncionarios && (
          <button style={btnNovo} onClick={abrirNovo}>
            {"+ Novo cadastro"}
          </button>
        )}
      </div>

      <div style={cardTabela}>
        <div style={scrollContainer}>
          <table style={tabela}>
            <thead style={thead}>
              <tr>
                <th style={th}>Funcionario</th>
                <th style={th}>Usuario</th>
                <th style={th}>Tipo</th>
                <th style={th}>Papel</th>
                {podeGerenciarFuncionarios && (
                  <th style={{ ...th, textAlign: "center" }}>Acoes</th>
                )}
              </tr>
            </thead>

            <tbody>
              {funcionariosFiltrados.length === 0 ? (
                <tr>
                  <td
                    style={{ ...td, textAlign: "center", color: "#888" }}
                    colSpan={podeGerenciarFuncionarios ? 5 : 4}
                  >
                    Sem dados para exibir
                  </td>
                </tr>
              ) : (
                funcionariosFiltrados.map((registro) => (
                  <tr
                    key={registro.id}
                    title={obterTooltipAuditoria(registro)}
                    className={`funcionarios-row ${
                      linhaSelecionada === registro.id ? "selecionada" : ""
                    }`}
                    onDoubleClick={() =>
                      setLinhaSelecionada(
                        linhaSelecionada === registro.id ? null : registro.id
                      )
                    }
                    style={{
                      cursor: "pointer",
                      transition: "0.2s"
                    }}
                  >
                    <td style={td}>{registro.nome}</td>
                    <td style={td}>{registro.usuarioLogin || "-"}</td>
                    <td style={td}>
                      {registro.tiposBrutos.length > 0 ? (
                        <span
                          className="funcionarios-badge funcionarios-badge-tipo"
                          style={obterEstiloBadgeTipo(registro.tiposBrutos)}
                        >
                          {registro.tipoLabel}
                        </span>
                      ) : null}
                    </td>
                    <td style={td}>
                      <span
                        className="funcionarios-badge funcionarios-badge-papel"
                        style={obterEstiloBadgePapel(registro.papelFuncional)}
                      >
                        {registro.papelLabel}
                      </span>
                    </td>
                    {podeGerenciarFuncionarios && (
                      <td style={acoesTd}>
                        <button
                          type="button"
                          style={btnEditar}
                          onClick={(event) => {
                            event.stopPropagation();
                            abrirEditar(registro);
                          }}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          style={{
                            ...btnExcluir,
                            ...(registro.podeExcluir ? null : btnDesabilitado)
                          }}
                          onClick={(event) => {
                            event.stopPropagation();
                            deletar(registro);
                          }}
                          disabled={!registro.podeExcluir}
                        >
                          Excluir
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <Modal onClose={fecharModal} size="sm">
          <h2 style={{ marginBottom: "12px" }}>
            {editando ? "Editar Cadastro" : "Novo Cadastro"}
          </h2>

          <p style={descricaoModal}>
            {"Cadastre aqui o papel funcional da pessoa e, se quiser, tambem o login dela no sistema."}
          </p>

          <label style={labelPadrao}>Nome</label>
          <input
            style={input}
            placeholder="Nome do funcionario"
            value={form.nome}
            onChange={(e) => atualizarFormulario("nome", e.target.value)}
          />

          <label style={labelPadrao}>Papel funcional</label>
          <select
            style={input}
            value={form.papel}
            onChange={(e) => {
              const valorSelecionado = e.target.value;
              setForm((atual) => ({
                ...atual,
                papel: valorSelecionado,
                papelCustomizado:
                  valorSelecionado === VALOR_NOVO_PAPEL ? atual.papelCustomizado : ""
              }));
            }}
            disabled={
              form.possuiLogin &&
              (String(form.tipo || "").trim().toUpperCase() === "COORDENADOR" ||
                String(form.tipo || "").trim().toUpperCase() === "SUPERVISOR")
            }
          >
            <option value="FUNCIONARIO">Funcionario padrao</option>
            <option value="SUPERVISOR">Lider</option>
            <option value="COORDENADOR">Coordenador</option>
            <option value={VALOR_NOVO_PAPEL}>
              {form.papel === VALOR_NOVO_PAPEL ? "Papel personalizado" : "Criar novo papel..."}
            </option>
          </select>

          {form.papel === VALOR_NOVO_PAPEL && (
            <>
              <label style={labelPadrao}>Novo papel funcional</label>
              <input
                style={input}
                placeholder="Ex.: Analista, Assistente, Especialista"
                value={form.papelCustomizado || ""}
                onChange={(e) => atualizarFormulario("papelCustomizado", e.target.value)}
              />
            </>
          )}

          <label style={labelPadrao}>Login no sistema</label>
          <select
            style={input}
            value={form.possuiLogin ? "SIM" : "NAO"}
            onChange={(e) =>
              atualizarFormulario("possuiLogin", e.target.value === "SIM")
            }
          >
            <option value="NAO">Sem login</option>
            <option value="SIM">Com login</option>
          </select>

          {form.possuiLogin && (
            <>
              <label style={labelPadrao}>Usuario</label>
              <input
                style={input}
                placeholder="Usuario"
                value={form.usuario}
                onChange={(e) => atualizarFormulario("usuario", e.target.value)}
                readOnly={false}
              />

              {!editando?.usuarioId && (
                <>
                  <label style={labelPadrao}>Senha</label>
                  <input
                    style={input}
                    placeholder="Senha"
                    type="password"
                    value={form.senha}
                    onChange={(e) => atualizarFormulario("senha", e.target.value)}
                  />
                </>
              )}

              {editando?.usuarioId && (
                <>
                  <label style={labelPadrao}>Redefinir senha (opcional)</label>
                  <input
                    style={input}
                    placeholder="Digite a nova senha"
                    type="password"
                    value={form.senha}
                    onChange={(e) => atualizarFormulario("senha", e.target.value)}
                  />
                </>
              )}

              <label style={labelPadrao}>Tipo de login</label>
              <select
                style={input}
                value={form.tipo}
                onChange={(e) => atualizarTipoLogin(e.target.value)}
              >
                <option value="ADMIN">ADMIN</option>
                {(isDeveloper || isEstrafiLogado) && (
                  <option value="DEVELOPER">DEVELOPER</option>
                )}
                <option value="PADRAO">PADRAO</option>
                <option value="COORDENADOR">COORDENADOR</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
              </select>
            </>
          )}

          <button style={btnSalvar} onClick={salvar}>
            Salvar
          </button>
        </Modal>
      )}
      </div>
    </Layout>
  );
}

const descricao = {
  marginTop: 0,
  marginBottom: "20px",
  color: "#475569",
  fontSize: "15px"
};

const descricaoModal = {
  marginTop: 0,
  marginBottom: "14px",
  color: "#475569",
  fontSize: "14px",
  lineHeight: 1.5
};

const labelPadrao = {
  display: "block",
  marginBottom: "8px",
  color: "#334155",
  fontWeight: "600",
  fontSize: "14px"
};

const cardFiltro = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: "16px",
  background: "white",
  padding: "20px",
  borderRadius: "14px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.08)",
  marginBottom: "20px"
};

const cardTabela = {
  background: "white",
  borderRadius: "12px",
  padding: "20px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)"
};

const scrollContainer = {
  maxHeight: "750px",
  overflowY: "auto",
  overflowX: "auto"
};

const tabela = {
  minWidth: "980px",
  width: "100%",
  maxWidth: "100%",
  borderCollapse: "collapse"
};

const thead = {
  position: "sticky",
  top: 0,
  background: "white",
  zIndex: 1
};

const th = {
  textAlign: "left",
  padding: "12px",
  borderBottom: "2px solid #aa9d9dfb",
  fontWeight: "800"
};

const td = {
  padding: "16px",
  borderBottom: "1px solid #e4e0e0",
  borderRight: "1px solid #f0eded",
  whiteSpace: "normal",
  wordBreak: "break-word",
  fontSize: "18px"
};

const acoesTd = {
  ...td,
  display: "flex",
  gap: "10px",
  justifyContent: "center",
  alignItems: "center"
};

const btnNovo = {
  padding: "10px 20px",
  background: "#0047AB",
  color: "white",
  border: "none",
  borderRadius: "8px",
  fontWeight: "600",
  cursor: "pointer"
};

const btnSecundario = {
  background: "#dc2626",
  color: "white",
  border: "none",
  padding: "8px 14px",
  borderRadius: "8px",
  fontSize: "16px",
  cursor: "pointer"
};

const btnSalvar = {
  marginTop: "15px",
  padding: "10px",
  background: "#0047AB",
  color: "white",
  border: "none",
  borderRadius: "8px",
  width: "100%",
  fontWeight: "600",
  cursor: "pointer"
};

const btnEditar = {
  background: "#16a34a",
  color: "white",
  border: "none",
  padding: "8px 14px",
  borderRadius: "6px",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.1)"
};

const btnExcluir = {
  background: "#dc2626",
  color: "white",
  border: "none",
  padding: "8px 14px",
  borderRadius: "6px",
  cursor: "pointer"
};

const btnDesabilitado = {
  opacity: 0.45,
  cursor: "not-allowed",
  boxShadow: "none"
};

const input = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
  fontSize: "18px",
  marginBottom: "12px"
};

const badgeBase = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: "20px",
  fontSize: "16px",
  fontWeight: "600"
};

const badgePadraoLogin = {
  ...badgeBase,
  background: "#e0f2fe",
  color: "#075985"
};

const badgeSupervisorLogin = {
  ...badgeBase,
  background: "#fef3c7",
  color: "#92400e"
};

const badgeCoordenadorLogin = {
  ...badgeBase,
  background: "#dcfce7",
  color: "#166534"
};

const badgeAdmin = {
  ...badgeBase,
  background: "#fee2e2",
  color: "#b91c1c"
};

const badgeDeveloper = {
  ...badgeBase,
  background: "#ede9fe",
  color: "#6d28d9"
};

const badgeMultiplo = {
  ...badgeBase,
  background: "#e2e8f0",
  color: "#334155"
};

const badgeFuncionarioFuncional = {
  ...badgeBase,
  background: "#e5e7eb",
  color: "#374151"
};

const badgeSupervisorFuncional = {
  ...badgeBase,
  background: "#fef3c7",
  color: "#92400e"
};

const badgeCoordenadorFuncional = {
  ...badgeBase,
  background: "#dcfce7",
  color: "#166534"
};

const badgePapelCustomizado = {
  ...badgeBase,
  background: "#dbeafe",
  color: "#1d4ed8"
};
