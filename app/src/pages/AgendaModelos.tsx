import { useState, useEffect } from "react";

/**
 * Área dos Modelos — Agenda pública do dia
 * Tela pra recepção/tablet mostrar quem chega e a que horas, sem precisar de
 * login (o modelo/cliente voluntário não tem conta no sistema). Pode ter mais
 * de um modelo no mesmo horário, atendidos por alunos diferentes.
 */

const GOLD = "#C58A4A";
const FUNCTIONS_BASE = "https://us-central1-barbearia-do-ico.cloudfunctions.net";

interface ItemAgenda {
  horario: string;
  modeloNome: string;
  alunoNome: string;
  status: "agendado" | "realizado" | "avaliado";
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function AgendaModelos() {
  const [data, setData] = useState(hojeISO());
  const [agenda, setAgenda] = useState<ItemAgenda[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${FUNCTIONS_BASE}/getAgendaDoDia?data=${data}`)
      .then((r) => r.json())
      .then((d) => setAgenda(d.agenda || []))
      .catch(() => setAgenda([]))
      .finally(() => setLoading(false));
  }, [data]);

  function formatDataExtenso(iso: string) {
    return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  }

  return (
    <div style={styles.page}>
      <div style={styles.wrap}>
        <div style={styles.logo}>Novo Jeito <em style={{ color: GOLD, fontStyle: "italic" }}>Academy</em></div>
        <div style={styles.eyebrow}>ÁREA DOS MODELOS</div>
        <h1 style={styles.h1}>{formatDataExtenso(data)}</h1>

        <input type="date" value={data} onChange={(e) => setData(e.target.value)} style={styles.dateInput} />

        {loading && <p style={styles.p}>Carregando agenda...</p>}
        {!loading && agenda.length === 0 && <p style={styles.p}>Nenhum horário agendado pra esse dia.</p>}

        {!loading && agenda.length > 0 && (
          <div style={styles.list}>
            {agenda.map((item, i) => (
              <div key={i} style={styles.row}>
                <div style={styles.horario}>{item.horario}</div>
                <div style={{ flex: 1 }}>
                  <div style={styles.modeloNome}>{item.modeloNome}</div>
                  <div style={styles.alunoNome}>com o aluno {item.alunoNome}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100dvh", background: "#050505", display: "flex", justifyContent: "center", padding: "2.4rem 1.5rem", fontFamily: "'Inter',sans-serif" },
  wrap: { maxWidth: 560, width: "100%", color: "#F5F0E8" },
  logo: { fontFamily: "'Playfair Display',serif", fontWeight: 900, fontSize: "1.1rem", marginBottom: "1.6rem" },
  eyebrow: { fontFamily: "'Space Mono',monospace", fontSize: "0.65rem", letterSpacing: "0.15em", color: GOLD },
  h1: { fontFamily: "'Playfair Display',serif", fontSize: "1.6rem", margin: "0.4rem 0 1.2rem", textTransform: "capitalize" },
  dateInput: { background: "#111", border: "1px solid rgba(197,138,74,.25)", borderRadius: 4, padding: "0.6rem 0.8rem", color: "#F5F0E8", fontSize: "0.85rem", marginBottom: "1.6rem" },
  p: { fontSize: "0.9rem", color: "#9d9384" },
  list: { display: "flex", flexDirection: "column", gap: "0.7rem" },
  row: { display: "flex", alignItems: "center", gap: "1rem", border: "1px solid rgba(197,138,74,.2)", borderRadius: 6, padding: "1rem 1.2rem", background: "linear-gradient(160deg,#0d0d0d,#050505)" },
  horario: { fontFamily: "'Space Mono',monospace", fontSize: "1.1rem", color: GOLD, fontWeight: 700, minWidth: 60 },
  modeloNome: { fontSize: "1rem", fontWeight: 600 },
  alunoNome: { fontSize: "0.8rem", color: "#9d9384", marginTop: "0.15rem" },
};
