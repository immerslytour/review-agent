'use client';
import { useState, useEffect } from "react";

// ─── Risk detection ───────────────────────────────────────────────────────────
const RISK_KEYWORDS = [
  "intoxicación","intoxicado","envenenamiento","enfermé","me enfermé","nos enfermamos",
  "cucaracha","cucarachas","ratón","ratones","plaga","plagas","sucio","sucia",
  "mugre","mugrienta","mugrienta","asco","asqueroso","asquerosa","bacteria",
  "bacterias","salmonela","norovirus","sanitario","sanidad","salubridad",
  "inspección","cerrado","clausurado","diarrea","vómito","vomité","hospitalizé",
  "hospital","médico","emergencia","food poisoning","sick","cockroach","rat","rats",
  "filthy","dirty","health department","contaminated","mold","mould"
];

function detectRisk(reviewText, stars) {
  const lower = reviewText.toLowerCase();
  const foundKeywords = RISK_KEYWORDS.filter(k => lower.includes(k));
  const isLowStars = stars <= 2;
  return { isRisk: isLowStars && foundKeywords.length > 0, keywords: foundKeywords };
}

// ─── Default restaurants ──────────────────────────────────────────────────────
const DEFAULT_RESTAURANTS = [
  { id: 1, name: "La Trattoria Roma", type: "Italiano", tone: "Cálido y familiar, usa 'familia' frecuentemente, menciona ingredientes frescos importados", city: "Ciudad de México" },
  { id: 2, name: "Burger Palace", type: "Americana", tone: "Joven, energético, usa emojis con moderación, habla de 'experiencia' y 'sabor auténtico'", city: "Monterrey" },
  { id: 3, name: "Sushi Nakamura", type: "Japonesa", tone: "Elegante y formal, agradece con respeto, menciona tradición japonesa y frescura del mar", city: "Guadalajara" },
  { id: 4, name: "El Rincón Mexicano", type: "Mexicana", tone: "Orgulloso de sus raíces, menciona recetas de la abuela, usa 'compadre' o 'amigo' ocasionalmente", city: "CDMX" },
  { id: 5, name: "The Grill House", type: "Parrilla", tone: "Directo y seguro, habla de cortes premium y experiencia de asador experto", city: "Monterrey" },
];

const STORAGE_KEY_RESTAURANTS = "review_agent_restaurants";
const STORAGE_KEY_QUEUE = "review_agent_queue";
const STORAGE_KEY_PROCESSED = "review_agent_processed";

// ─── API Call ─────────────────────────────────────────────────────────────────
async function generateResponse(restaurant, reviewText, stars, reviewerName) {
  const riskInfo = detectRisk(reviewText, stars);
  
  const systemPrompt = `Eres el gerente de relaciones públicas de ${restaurant.name}, un restaurante de comida ${restaurant.type}.
Tono de respuesta: ${restaurant.tone}
Ciudad: ${restaurant.city}

REGLAS ABSOLUTAS:
1. Responde SIEMPRE en el idioma de la reseña
2. Máximo 120 palabras
3. Menciona el nombre del cliente si está disponible
4. Si la reseña es positiva (4-5 estrellas): agradece con entusiasmo y personalización específica
5. Si es negativa (1-3 estrellas): acepta la crítica con humildad, ofrece solución concreta, invita a regresar
6. Nunca seas genérico ni copies frases de plantilla
7. Termina siempre con el nombre del restaurante o una firma cálida
8. NO uses hashtags ni lenguaje de marketing corporativo`;

  const userPrompt = `Reseña recibida:
Nombre del cliente: ${reviewerName || "Cliente"}
Estrellas: ${stars}/5
Texto: "${reviewText}"

Genera UNA respuesta profesional y auténtica para esta reseña.`;

  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }]
    })
  });

  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  return { text, isRisk: riskInfo.isRisk, keywords: riskInfo.keywords };
}

// ─── Stars component ──────────────────────────────────────────────────────────
function Stars({ value, onChange, size = 20 }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1,2,3,4,5].map(s => (
        <span
          key={s}
          onClick={() => onChange && onChange(s)}
          style={{
            fontSize: size,
            cursor: onChange ? "pointer" : "default",
            color: s <= value ? "#f59e0b" : "#d1d5db",
            transition: "color 0.15s"
          }}
        >★</span>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function ReviewAgent() {
  const [tab, setTab] = useState("process"); // process | queue | history | restaurants
  const [restaurants, setRestaurants] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_RESTAURANTS)) || DEFAULT_RESTAURANTS; }
    catch { return DEFAULT_RESTAURANTS; }
  });
  const [queue, setQueue] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_QUEUE)) || []; }
    catch { return []; }
  });
  const [processed, setProcessed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY_PROCESSED)) || []; }
    catch { return []; }
  });

  // Form state
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [stars, setStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Batch state
  const [batchMode, setBatchMode] = useState(false);
  const [batchText, setBatchText] = useState("");
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Restaurant form
  const [showRestaurantForm, setShowRestaurantForm] = useState(false);
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [rForm, setRForm] = useState({ name: "", type: "", tone: "", city: "" });

  useEffect(() => { localStorage.setItem(STORAGE_KEY_RESTAURANTS, JSON.stringify(restaurants)); }, [restaurants]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue)); }, [queue]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PROCESSED, JSON.stringify(processed)); }, [processed]);

  const addToProcessed = (item) => setProcessed(p => [item, ...p].slice(0, 500));
  const addToQueue = (item) => setQueue(q => [item, ...q]);

  async function handleProcess() {
    if (!selectedRestaurant || !reviewText.trim()) return;
    const restaurant = restaurants.find(r => r.id === parseInt(selectedRestaurant));
    if (!restaurant) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await generateResponse(restaurant, reviewText, stars, reviewerName);
      const entry = {
        id: Date.now(),
        restaurant: restaurant.name,
        restaurantId: restaurant.id,
        reviewerName,
        stars,
        reviewText,
        response: res.text,
        isRisk: res.isRisk,
        keywords: res.keywords,
        timestamp: new Date().toISOString(),
        status: res.isRisk ? "queue" : "ready"
      };
      if (res.isRisk) {
        addToQueue(entry);
        setResult({ ...entry, queued: true });
      } else {
        addToProcessed(entry);
        setResult({ ...entry, queued: false });
      }
      setReviewText("");
      setReviewerName("");
      setStars(5);
    } catch(e) {
      setResult({ error: "Error al conectar con la IA. Verifica tu conexión." });
    }
    setLoading(false);
  }

  async function handleBatch() {
    if (!selectedRestaurant || !batchText.trim()) return;
    const restaurant = restaurants.find(r => r.id === parseInt(selectedRestaurant));
    if (!restaurant) return;

    // Parse batch: lines starting with --- separate reviews
    // Format: STARS|NAME|TEXT or just TEXT
    const blocks = batchText.split(/
---+
/).map(b => b.trim()).filter(Boolean);
    setBatchLoading(true);
    setBatchProgress(0);

    for (let i = 0; i < blocks.length; i++) {
      const lines = blocks[i].split("
");
      let bStars = 5, bName = "", bText = blocks[i];
      if (lines[0].includes("|")) {
        const parts = lines[0].split("|");
        bStars = parseInt(parts[0]) || 5;
        bName = parts[1]?.trim() || "";
        bText = lines.slice(1).join("
").trim() || parts[2]?.trim() || "";
      }
      try {
        const res = await generateResponse(restaurant, bText, bStars, bName);
        const entry = {
          id: Date.now() + i,
          restaurant: restaurant.name,
          restaurantId: restaurant.id,
          reviewerName: bName,
          stars: bStars,
          reviewText: bText,
          response: res.text,
          isRisk: res.isRisk,
          keywords: res.keywords,
          timestamp: new Date().toISOString(),
          status: res.isRisk ? "queue" : "ready"
        };
        if (res.isRisk) addToQueue(entry);
        else addToProcessed(entry);
      } catch(e) {}
      setBatchProgress(Math.round(((i + 1) / blocks.length) * 100));
    }
    setBatchLoading(false);
    setBatchText("");
    setTab("history");
  }

  function approveFromQueue(id) {
    const item = queue.find(q => q.id === id);
    if (!item) return;
    addToProcessed({ ...item, status: "approved" });
    setQueue(q => q.filter(x => x.id !== id));
  }

  function discardFromQueue(id) {
    setQueue(q => q.filter(x => x.id !== id));
  }

  function copyText(text) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function saveRestaurant() {
    if (!rForm.name.trim()) return;
    if (editingRestaurant) {
      setRestaurants(rs => rs.map(r => r.id === editingRestaurant ? { ...r, ...rForm } : r));
    } else {
      setRestaurants(rs => [...rs, { id: Date.now(), ...rForm }]);
    }
    setShowRestaurantForm(false);
    setEditingRestaurant(null);
    setRForm({ name: "", type: "", tone: "", city: "" });
  }

  function deleteRestaurant(id) {
    if (confirm("¿Eliminar este restaurante?")) {
      setRestaurants(rs => rs.filter(r => r.id !== id));
    }
  }

  // ─── Styles ────────────────────────────────────────────────────────────────
  const colors = {
    bg: "#0f1117",
    surface: "#1a1d27",
    card: "#21253a",
    border: "#2e3352",
    accent: "#6c63ff",
    accentLight: "#8b85ff",
    success: "#10b981",
    warning: "#f59e0b",
    danger: "#ef4444",
    text: "#e2e8f0",
    muted: "#64748b",
    gold: "#f59e0b"
  };

  const styles = {
    app: { minHeight: "100vh", background: colors.bg, color: colors.text, fontFamily: "'Inter', system-ui, sans-serif", padding: "0" },
    header: { background: colors.surface, borderBottom: `1px solid ${colors.border}`, padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    logo: { display: "flex", alignItems: "center", gap: 10 },
    logoIcon: { width: 32, height: 32, background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentLight})`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
    logoText: { fontWeight: 700, fontSize: 17, color: colors.text },
    logoSub: { fontSize: 11, color: colors.muted },
    tabs: { display: "flex", gap: 4, background: colors.surface, borderBottom: `1px solid ${colors.border}`, padding: "0 24px" },
    tab: (active) => ({ padding: "12px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer", border: "none", background: "transparent", color: active ? colors.accentLight : colors.muted, borderBottom: `2px solid ${active ? colors.accentLight : "transparent"}`, transition: "all 0.15s" }),
    content: { maxWidth: 900, margin: "0 auto", padding: "24px 24px" },
    card: { background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 20, marginBottom: 16 },
    label: { display: "block", fontSize: 12, fontWeight: 600, color: colors.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" },
    input: { width: "100%", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 12px", color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    textarea: { width: "100%", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 12px", color: colors.text, fontSize: 14, outline: "none", resize: "vertical", boxSizing: "border-box" },
    select: { width: "100%", background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 8, padding: "10px 12px", color: colors.text, fontSize: 14, outline: "none", boxSizing: "border-box" },
    btn: (variant = "primary") => ({
      padding: "10px 20px", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", transition: "all 0.15s",
      background: variant === "primary" ? colors.accent : variant === "success" ? colors.success : variant === "danger" ? colors.danger : colors.surface,
      color: variant === "ghost" ? colors.muted : "#fff"
    }),
    badge: (type) => ({
      display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600,
      background: type === "risk" ? "#ef444420" : type === "ok" ? "#10b98120" : "#6c63ff20",
      color: type === "risk" ? colors.danger : type === "ok" ? colors.success : colors.accentLight
    }),
    row: { display: "flex", gap: 12, alignItems: "flex-start" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    sectionTitle: { fontSize: 18, fontWeight: 700, color: colors.text, marginBottom: 4 },
    sectionSub: { fontSize: 13, color: colors.muted, marginBottom: 20 },
    divider: { height: 1, background: colors.border, margin: "16px 0" },
    resultBox: (isRisk) => ({
      background: isRisk ? "#ef444410" : "#10b98110",
      border: `1px solid ${isRisk ? colors.danger : colors.success}40`,
      borderRadius: 10, padding: 16, marginTop: 16
    }),
    statsRow: { display: "flex", gap: 12, marginBottom: 20 },
    stat: { flex: 1, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "14px 16px", textAlign: "center" },
    statNum: { fontSize: 24, fontWeight: 700, color: colors.accentLight },
    statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  };

  // ─── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total: processed.length + queue.length,
    processed: processed.length,
    queue: queue.length,
    restaurants: restaurants.length
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>⭐</div>
          <div>
            <div style={styles.logoText}>ReviewAgent</div>
            <div style={styles.logoSub}>Gestión inteligente de reseñas</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, fontSize: 12, color: colors.muted }}>
          <span style={{ color: colors.success }}>●</span> {restaurants.length} restaurantes
          {queue.length > 0 && <span style={{ color: colors.danger, marginLeft: 8 }}>⚠ {queue.length} en cola</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { id: "process", label: "Procesar reseñas" },
          { id: "queue", label: `Cola de revisión ${queue.length > 0 ? `(${queue.length})` : ""}` },
          { id: "history", label: "Historial" },
          { id: "restaurants", label: "Restaurantes" },
        ].map(t => (
          <button key={t.id} style={styles.tab(tab === t.id)} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      <div style={styles.content}>

        {/* ── PROCESS TAB ─────────────────────────────────────────────────── */}
        {tab === "process" && (
          <>
            <div style={styles.statsRow}>
              {[
                { num: stats.total, label: "Reseñas totales" },
                { num: stats.processed, label: "Procesadas" },
                { num: stats.queue, label: "En revisión" },
                { num: stats.restaurants, label: "Restaurantes" },
              ].map((s, i) => (
                <div key={i} style={styles.stat}>
                  <div style={styles.statNum}>{s.num}</div>
                  <div style={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={styles.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={styles.sectionTitle}>{batchMode ? "Procesamiento en lote" : "Nueva reseña"}</div>
                  <div style={styles.sectionSub}>{batchMode ? "Procesa múltiples reseñas de un restaurante a la vez" : "Genera una respuesta para una reseña individual"}</div>
                </div>
                <button style={styles.btn("ghost")} onClick={() => { setBatchMode(!batchMode); setResult(null); }}>
                  {batchMode ? "Modo individual" : "Modo lote"}
                </button>
              </div>

              {/* Restaurant selector */}
              <div style={{ marginBottom: 14 }}>
                <label style={styles.label}>Restaurante</label>
                <select style={styles.select} value={selectedRestaurant} onChange={e => setSelectedRestaurant(e.target.value)}>
                  <option value="">— Selecciona un restaurante —</option>
                  {restaurants.map(r => (
                    <option key={r.id} value={r.id}>{r.name} · {r.city}</option>
                  ))}
                </select>
              </div>

              {!batchMode ? (
                <>
                  <div style={styles.grid2}>
                    <div>
                      <label style={styles.label}>Nombre del cliente</label>
                      <input style={styles.input} placeholder="Ej: María García" value={reviewerName} onChange={e => setReviewerName(e.target.value)} />
                    </div>
                    <div>
                      <label style={styles.label}>Calificación</label>
                      <div style={{ paddingTop: 8 }}>
                        <Stars value={stars} onChange={setStars} size={26} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 14 }}>
                    <label style={styles.label}>Texto de la reseña</label>
                    <textarea style={{ ...styles.textarea, minHeight: 100 }} placeholder="Pega aquí la reseña del cliente..." value={reviewText} onChange={e => setReviewText(e.target.value)} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button style={{ ...styles.btn("primary"), opacity: (loading || !selectedRestaurant || !reviewText.trim()) ? 0.5 : 1 }}
                      onClick={handleProcess} disabled={loading || !selectedRestaurant || !reviewText.trim()}>
                      {loading ? "Generando..." : "Generar respuesta"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginTop: 4 }}>
                    <label style={styles.label}>Reseñas (separa con ---)</label>
                    <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>
                      Formato por reseña: <code style={{ background: colors.surface, padding: "2px 6px", borderRadius: 4 }}>ESTRELLAS|NOMBRE|TEXTO</code> o solo el texto. Separa con <code style={{ background: colors.surface, padding: "2px 6px", borderRadius: 4 }}>---</code>
                    </div>
                    <textarea style={{ ...styles.textarea, minHeight: 180 }}
                      placeholder={`5|Carlos López|Excelente servicio, la pasta estaba increíble!
---
2|Ana
La comida llegó fría y el servicio fue lento.
---
Muy buen ambiente, volveré pronto.`}
                      value={batchText} onChange={e => setBatchText(e.target.value)} />
                  </div>
                  {batchLoading && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 13, color: colors.muted, marginBottom: 6 }}>Procesando... {batchProgress}%</div>
                      <div style={{ height: 6, background: colors.surface, borderRadius: 3 }}>
                        <div style={{ height: "100%", width: `${batchProgress}%`, background: colors.accent, borderRadius: 3, transition: "width 0.3s" }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                    <button style={{ ...styles.btn("primary"), opacity: (batchLoading || !selectedRestaurant || !batchText.trim()) ? 0.5 : 1 }}
                      onClick={handleBatch} disabled={batchLoading || !selectedRestaurant || !batchText.trim()}>
                      {batchLoading ? `Procesando ${batchProgress}%...` : "Procesar todas"}
                    </button>
                  </div>
                </>
              )}

              {/* Result */}
              {result && !batchMode && (
                <div style={styles.resultBox(result.isRisk)}>
                  {result.error ? (
                    <div style={{ color: colors.danger }}>{result.error}</div>
                  ) : (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        {result.isRisk ? (
                          <span style={styles.badge("risk")}>⚠ Enviada a cola de revisión</span>
                        ) : (
                          <span style={styles.badge("ok")}>✓ Lista para publicar</span>
                        )}
                        <Stars value={result.stars} size={14} />
                      </div>
                      {result.isRisk && (
                        <div style={{ fontSize: 12, color: colors.danger, marginBottom: 10 }}>
                          Palabras de riesgo detectadas: {result.keywords.join(", ")}
                        </div>
                      )}
                      <div style={{ fontSize: 14, lineHeight: 1.6, color: colors.text, marginBottom: 12 }}>
                        {result.response}
                      </div>
                      {!result.isRisk && (
                        <button style={styles.btn("success")} onClick={() => copyText(result.response)}>
                          {copied ? "¡Copiado!" : "Copiar respuesta"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── QUEUE TAB ───────────────────────────────────────────────────── */}
        {tab === "queue" && (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={styles.sectionTitle}>Cola de revisión manual</div>
              <div style={styles.sectionSub}>Reseñas con 1-2 estrellas que mencionan problemas de sanidad u otros riesgos</div>
            </div>
            {queue.length === 0 ? (
              <div style={{ ...styles.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
                <div style={{ color: colors.muted }}>Sin reseñas pendientes de revisión</div>
              </div>
            ) : queue.map(item => (
              <div key={item.id} style={{ ...styles.card, borderColor: `${colors.danger}40` }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.restaurant}</div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      {item.reviewerName || "Cliente anónimo"} · {new Date(item.timestamp).toLocaleDateString("es-MX")}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Stars value={item.stars} size={14} />
                    <span style={styles.badge("risk")}>⚠ Riesgo</span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: colors.danger, marginBottom: 8 }}>
                  Palabras detectadas: {item.keywords.join(", ")}
                </div>
                <div style={styles.divider} />
                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Reseña:</div>
                <div style={{ fontSize: 13, color: colors.text, marginBottom: 12, fontStyle: "italic" }}>"{item.reviewText}"</div>
                <div style={{ fontSize: 13, color: colors.muted, marginBottom: 4 }}>Respuesta sugerida:</div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, marginBottom: 14 }}>{item.response}</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.btn("success")} onClick={() => { copyText(item.response); approveFromQueue(item.id); }}>
                    Aprobar y copiar
                  </button>
                  <button style={styles.btn("danger")} onClick={() => discardFromQueue(item.id)}>Descartar</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── HISTORY TAB ─────────────────────────────────────────────────── */}
        {tab === "history" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={styles.sectionTitle}>Historial</div>
                <div style={styles.sectionSub}>{processed.length} respuestas generadas</div>
              </div>
              {processed.length > 0 && (
                <button style={styles.btn("danger")} onClick={() => { if(confirm("¿Limpiar historial?")) setProcessed([]); }}>
                  Limpiar historial
                </button>
              )}
            </div>
            {processed.length === 0 ? (
              <div style={{ ...styles.card, textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
                <div style={{ color: colors.muted }}>El historial de respuestas aparecerá aquí</div>
              </div>
            ) : processed.map(item => (
              <div key={item.id} style={styles.card}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{item.restaurant}</div>
                    <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                      {item.reviewerName || "Anónimo"} · {new Date(item.timestamp).toLocaleDateString("es-MX", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Stars value={item.stars} size={13} />
                    <span style={styles.badge(item.status === "approved" ? "risk" : "ok")}>
                      {item.status === "approved" ? "Aprobada manualmente" : "Auto-aprobada"}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: colors.muted, fontStyle: "italic", marginBottom: 8 }}>"{item.reviewText?.slice(0, 120)}{item.reviewText?.length > 120 ? "..." : ""}"</div>
                <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, marginBottom: 10 }}>{item.response}</div>
                <button style={{ ...styles.btn("ghost"), fontSize: 12, padding: "6px 12px" }} onClick={() => copyText(item.response)}>
                  Copiar
                </button>
              </div>
            ))}
          </>
        )}

        {/* ── RESTAURANTS TAB ─────────────────────────────────────────────── */}
        {tab === "restaurants" && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={styles.sectionTitle}>Restaurantes</div>
                <div style={styles.sectionSub}>{restaurants.length} negocios registrados</div>
              </div>
              <button style={styles.btn("primary")} onClick={() => { setShowRestaurantForm(true); setEditingRestaurant(null); setRForm({ name: "", type: "", tone: "", city: "" }); }}>
                + Agregar restaurante
              </button>
            </div>

            {showRestaurantForm && (
              <div style={{ ...styles.card, borderColor: colors.accent + "60", marginBottom: 16 }}>
                <div style={{ fontWeight: 600, marginBottom: 14 }}>{editingRestaurant ? "Editar restaurante" : "Nuevo restaurante"}</div>
                <div style={styles.grid2}>
                  <div>
                    <label style={styles.label}>Nombre</label>
                    <input style={styles.input} placeholder="Ej: La Trattoria Roma" value={rForm.name} onChange={e => setRForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div>
                    <label style={styles.label}>Tipo de cocina</label>
                    <input style={styles.input} placeholder="Ej: Italiana, Mexicana..." value={rForm.type} onChange={e => setRForm(f => ({ ...f, type: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={styles.label}>Ciudad</label>
                  <input style={styles.input} placeholder="Ej: Ciudad de México" value={rForm.city} onChange={e => setRForm(f => ({ ...f, city: e.target.value }))} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <label style={styles.label}>Tono y personalidad</label>
                  <textarea style={{ ...styles.textarea, minHeight: 80 }}
                    placeholder="Ej: Cálido y familiar, usa 'familia' frecuentemente, menciona ingredientes frescos importados de Italia..."
                    value={rForm.tone} onChange={e => setRForm(f => ({ ...f, tone: e.target.value }))} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <button style={styles.btn("primary")} onClick={saveRestaurant}>Guardar</button>
                  <button style={styles.btn("ghost")} onClick={() => setShowRestaurantForm(false)}>Cancelar</button>
                </div>
              </div>
            )}

            <div style={{ display: "grid", gap: 12 }}>
              {restaurants.map(r => (
                <div key={r.id} style={styles.card}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{r.name}</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{r.type} · {r.city}</div>
                      <div style={{ fontSize: 12, color: colors.muted, marginTop: 6, lineHeight: 1.5 }}>{r.tone}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6, marginLeft: 12 }}>
                      <button style={{ ...styles.btn("ghost"), fontSize: 12, padding: "6px 12px" }} onClick={() => {
                        setRForm({ name: r.name, type: r.type, tone: r.tone, city: r.city });
                        setEditingRestaurant(r.id);
                        setShowRestaurantForm(true);
                      }}>Editar</button>
                      <button style={{ ...styles.btn("danger"), fontSize: 12, padding: "6px 12px" }} onClick={() => deleteRestaurant(r.id)}>✕</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}