# DiarioFit — Sync com Google Sheets

Tempo total: ~5 min. Você precisa fazer isso UMA vez.

## 1. Criar a planilha

1. Abre https://sheets.new (cria uma planilha em branco)
2. Renomeia o arquivo (canto superior esquerdo) pra `DiarioFit_Historico`
3. Não precisa criar abas nem cabeçalhos — o script faz tudo sozinho

## 2. Colar o Apps Script

1. Na planilha aberta: menu **Extensões → Apps Script**
2. Apaga TODO o código que aparece (o `function myFunction() {}` padrão)
3. Cola o código abaixo:

```javascript
// DiarioFit Sync — recebe POST do app e grava em 4 abas
const HEADERS = {
  Dias: ["device_id","device_name","date","weekday","label","consumed","burned","deficit","tdee","target","p","c","g","water","notes","saved","synced_at"],
  Refeicoes: ["device_id","device_name","date","idx","name","time","kcal","foods","p","c","g","text","assessment","tip"],
  Exercicios: ["device_id","device_name","date","name","vol","sets_total","sets_done","extra"],
  Cardios: ["device_id","device_name","date","idx","type","min","kcal"],
};

function ensureSheet_(ss, name) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight("bold");
    sh.setFrozenRows(1);
  } else if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS[name]);
    sh.getRange(1, 1, 1, HEADERS[name].length).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

function deleteRowsForKey_(sh, deviceId, date) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return;
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(deviceId) && String(data[i][2]) === String(date)) {
      sh.deleteRow(i + 1);
    }
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sDias = ensureSheet_(ss, "Dias");
    const sRef  = ensureSheet_(ss, "Refeicoes");
    const sExer = ensureSheet_(ss, "Exercicios");
    const sCard = ensureSheet_(ss, "Cardios");

    const did  = payload.device_id || "unknown";
    const dn   = payload.device_name || "";
    const date = payload.date;
    if (!date) throw new Error("date missing");

    // Upsert: apaga registros anteriores deste device+data
    deleteRowsForKey_(sDias, did, date);
    deleteRowsForKey_(sRef,  did, date);
    deleteRowsForKey_(sExer, did, date);
    deleteRowsForKey_(sCard, did, date);

    sDias.appendRow([
      did, dn, date,
      payload.weekday || "", payload.label || "",
      payload.consumed || 0, payload.burned || 0, payload.deficit || 0,
      payload.tdee || 0, payload.target || 0,
      payload.macros_p || 0, payload.macros_c || 0, payload.macros_g || 0,
      payload.water || 0, payload.notes || "",
      payload.saved ? "sim" : "nao",
      payload.synced_at || new Date().toISOString(),
    ]);

    (payload.meals || []).forEach(m => {
      sRef.appendRow([
        did, dn, date,
        m.idx || 0, m.name || "", m.time || "",
        m.kcal || 0, m.foods || "",
        m.p || 0, m.c || 0, m.g || 0,
        m.text || "", m.assessment || "", m.tip || "",
      ]);
    });

    (payload.exercises || []).forEach(ex => {
      sExer.appendRow([
        did, dn, date,
        ex.name || "", ex.vol || "",
        ex.sets_total || 0, ex.sets_done || 0,
        ex.extra ? "sim" : "nao",
      ]);
    });

    (payload.cardios || []).forEach((c, i) => {
      sCard.appendRow([
        did, dn, date, i,
        c.type || "", c.min || 0, c.kcal || 0,
      ]);
    });

    return ContentService.createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    message: "DiarioFit Sync ativo",
    time: new Date().toISOString(),
  })).setMimeType(ContentService.MimeType.JSON);
}
```

4. Salva (Ctrl+S ou ícone de disquete) — pode ser que peça pra dar nome ao projeto: `DiarioFit Sync` está bom

## 3. Publicar como Web App

1. No Apps Script, clica no botão **Implantar** (canto superior direito) → **Nova implantação**
2. No engrenagem ⚙️ ao lado de "Selecionar tipo", escolhe **App da Web**
3. Preenche:
   - **Descrição:** `DiarioFit Sync v1`
   - **Executar como:** Eu (`projetos.ia@proxximatelecom.com.br`)
   - **Quem pode acessar:** **Qualquer pessoa**
4. Clica em **Implantar**
5. Vai pedir autorização — clica em **Autorizar acesso** → escolhe sua conta Google → **Avançado** → **Acessar DiarioFit Sync (não seguro)** → **Permitir**
6. Copia a **URL do app da Web** (algo tipo `https://script.google.com/macros/s/AKfycbx.../exec`)

## 4. Colar URL no app

1. Abre https://romarioproxxima.github.io/plano-barriga/ no celular
2. Vai em **⚙️**
3. Em **SYNC NA NUVEM (Google Sheets)**, cola a URL
4. Em **NOME DESTE DEVICE**, escreve `Romário` (e na esposa, `Esposa`)
5. Aperta o botão **☁ Subir histórico todo** pra mandar tudo o que já tá salvo

Pronto. A partir de agora, toda alteração que você fizer (refeição, exercício, cardio, anotação) replica na planilha em segundos.

## Como eu leio depois

Quando você quiser análise da semana, abre a planilha → menu **Arquivo → Compartilhar → Publicar na Web** → publica a aba `Dias` (ou todas) como CSV. Cola o link aqui no chat e eu leio direto. Ou, melhor ainda, me dá acesso de leitura na planilha que eu mesmo puxo via gviz (igual o Dashboard de Cartões).

## Quando precisar atualizar o script

Se eu mandar uma versão nova do código:

1. Cola o novo código no Apps Script (substituindo todo o anterior)
2. Salva
3. Implantar → **Gerenciar implantações** → ícone de lápis na implantação atual → **Versão: nova versão** → Implantar
4. A URL **continua a mesma** — não precisa mexer no app

Não cria implantação nova senão a URL muda.
