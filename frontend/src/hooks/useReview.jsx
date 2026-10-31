import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../infra/api/api";

export function useReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [editError, setEditError] = useState(null);
  const [downloadFormat, setDownloadFormat] = useState("xlsx");

  const [status, setStatus] = useState("processando");
  const [transcError, setTranscError] = useState(null);

  useEffect(() => {
    if (!id) {
      navigate("/");
      return;
    }

    const poll = async () => {
      try {
        const responseData = await api.getById(id);

        setStatus(responseData.status);
        setTranscError(responseData.error);
        setData(responseData);

        if (responseData.status === "concluido" || responseData.status === "erro") {
          setLoading(false);
        }
      } catch (err) {
        const is404 = err.response?.status === 404;

        if (!is404) {
          setStatus("erro");
          setError(err.message || "Erro interno do servidor");
          setLoading(false);
        } else {
          setError("Aguardando inicialização do servidor...");
        }
      }
    };

    poll();

    const interval = setInterval(() => {
      if (status === "processando") {
        poll();
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [id, status, navigate]);


  const handleDownload = async () => {
    try {
      const response = await api.getDownloadFile(id, downloadFormat);

      if (downloadFormat === "json") {
        const dataStr = JSON.stringify(response.data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcricao-${id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        const url = URL.createObjectURL(response.data);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transcricao-${id}.${downloadFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      alert("Erro ao baixar: " + err.message);
    }
  };

  const handleSave = async () => {
    try {
      const value = JSON.parse(draft);
      const updated = await api.update(id, value);
      setData(previous => ({ ...previous, ...updated }));
      setEditing(false);
      setEditError(null);
      alert("✅ Salvo com sucesso!");
    } catch (err) {
      setEditError(err instanceof SyntaxError
        ? "O JSON está inválido. Corrija a estrutura antes de salvar."
        : "Não foi possível salvar a transcrição: " + err.message);
    }
  };

  const toggleEditing = () => {
    if (!editing) {
      setDraft(JSON.stringify(data.value, null, 2));
      setEditError(null);
    }
    setEditing(!editing);
  };

  return {
    data,
    loading,
    error: error || transcError,
    editing,
    downloadFormat,
    status,
    draft,
    editError,
    setDraft,
    toggleEditing,
    setDownloadFormat,
    handleDownload,
    handleSave,
    navigate
  };
}
