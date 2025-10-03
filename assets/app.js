/* Firebase Sesiones Plugin - RTDB (compat) v0.5
   - Autenticación Firebase (Auth compat)
   - Cierra datos si no hay sesión
   - Mantiene buscador y parseo de "time:0:0:18"
*/
(function(){
  const DEBUG = false;

  // CONFIG Firebase: reemplaza con tus valores reales
  const firebaseConfig = {
    apiKey: "AIzaSyArEd_SS2zXW7FFIVCUFF6JyXtUsNN1TZg",
    authDomain: "pruebaproject-808af.firebaseapp.com",
    databaseURL: "https://pruebaproject-808af-default-rtdb.firebaseio.com",
    projectId: "pruebaproject-808af"
  };

  /* ---------- Carga SDK compat ---------- */
  function loadScript(src){
    return new Promise((res, rej)=>{
      const s=document.createElement('script');
      s.src=src; s.async=true; s.referrerPolicy="no-referrer";
      s.onload=res; s.onerror=()=>rej(new Error('No se pudo cargar '+src));
      document.head.appendChild(s);
    });
  }
  async function ensureFirebase(){
    if (window.firebase?.apps?.length) return;
    await loadScript('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/11.0.1/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/11.0.1/firebase-database-compat.js');
    firebase.initializeApp(firebaseConfig);
  }

  /* ---------- Helpers ---------- */
  const log = (...a)=>{ if (DEBUG) console.log('[FS]', ...a); };

  function normalizeTimeString(str){
    if (typeof str !== 'string') return null;
    let clean = str.trim();
    if (/^[a-zA-Z]+:/.test(clean)){ clean = clean.substring(clean.indexOf(':')+1); }
    clean = clean.replace(/[^0-9:]/g,'');
    return clean;
  }
  function parseHMSFlexible(str){
    const norm = normalizeTimeString(str);
    if (!norm) return null;
    const parts = norm.split(':').map(n=>parseInt(n,10));
    if (parts.some(Number.isNaN)) return null;
    let h=0,m=0,s=0;
    if (parts.length===3) [h,m,s]=parts;
    else if (parts.length===2) [m,s]=parts;
    else [s]=parts;
    return h*3600 + m*60 + s;
  }
  function toHMS(sec){
    if (!Number.isFinite(sec) || sec < 0) return '0:00';
    const s=Math.round(sec), hh=Math.floor(s/3600), mm=Math.floor((s%3600)/60), ss=s%60;
    const pad=n=>String(n).padStart(2,'0');
    return hh>0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
  }
  function extractSeconds(val){
    if (typeof val==='string'){ const secs=parseHMSFlexible(val); if (secs!=null) return secs; }
    else if (typeof val==='number' && Number.isFinite(val)){ return val>100000 ? val/1000 : val; }
    else if (val && typeof val==='object'){
      const keys=['time','tiempo','duration','seconds','segundos','hms','valor','value'];
      for (const k of keys){ if (Object.prototype.hasOwnProperty.call(val,k)){ const x=extractSeconds(val[k]); if (x!=null) return x; } }
      for (const v of Object.values(val)){ const x=extractSeconds(v); if (x!=null) return x; }
    }
    return null;
  }

  function buildTablaUsuarios(lista){
    let html = '<table class="fs-tabla"><thead><tr>' +
      '<th>Usuario</th><th class="right">Sesiones</th><th class="right">Tiempo total</th>' +
      '</tr></thead><tbody>';
    lista.forEach(r=>{
      html += `<tr data-fs-user="${r.user}">
        <td>${r.user}</td>
        <td class="right">${r.sesiones}</td>
        <td class="right">${toHMS(r.total)}</td>
      </tr>`;
    });
    html += '</tbody></table>';
    return html;
  }

  /* ---------- Estado ---------- */
  let datasetUsuarios = []; // [{user, sesiones, total}]
  let authUnsub = null;

  /* ---------- UI Auth ---------- */
  function setAuthUI(state){
    const wrapData = document.getElementById('fs-data');
    const authBox = document.getElementById('fs-auth');
    const authStatus = document.getElementById('fs-auth-status');
    const btnLogin = document.getElementById('fs-login');
    const btnLogout = document.getElementById('fs-logout');

    const detailBox = document.getElementById('fs-detalle');
    const authDetalle = document.getElementById('fs-auth-detalle');

    if (state === 'in'){
      if (authStatus) authStatus.textContent = 'Sesión iniciada.';
      if (btnLogin) btnLogin.style.display = 'none';
      if (btnLogout) btnLogout.style.display = '';
      if (wrapData){ wrapData.style.display=''; wrapData.setAttribute('aria-hidden','false'); }
      if (authBox) authBox.classList.remove('fs-auth-warning');
      if (authDetalle) authDetalle.style.display='none';
      if (detailBox) { detailBox.style.display=''; detailBox.setAttribute('aria-hidden','false'); }
    } else {
      if (authStatus) authStatus.textContent = 'Necesitas iniciar sesión para ver los datos.';
      if (btnLogin) btnLogin.style.display = '';
      if (btnLogout) btnLogout.style.display = 'none';
      if (wrapData){ wrapData.style.display='none'; wrapData.setAttribute('aria-hidden','true'); }
      if (authBox) authBox.classList.add('fs-auth-warning');
      if (detailBox){ detailBox.style.display='none'; detailBox.setAttribute('aria-hidden','true'); detailBox.textContent='Cargando…'; }
      if (authDetalle) authDetalle.style.display='';
      // Limpia tabla si quieres
      const usersEl = document.querySelector('#fs-usuarios'); if (usersEl) usersEl.innerHTML = '';
    }
  }

  async function doLogin(){
    await ensureFirebase();
    // Por defecto: login anónimo. Cambia por Google/Email si habilitas esos proveedores.
    // Ejemplo Google:
    // const provider = new firebase.auth.GoogleAuthProvider();
    // await firebase.auth().signInWithPopup(provider);
    const email = document.getElementById('fs-email').value;
    const pass = document.getElementById('fs-pass').value;
    try{
      await firebase.auth().signInWithEmailAndPassword(email, pass);
      window.location.href = "https://clientes.coren.cl/usuarios/";
    }catch(e){
      console.error('Login error', e);
      alert('No se pudo iniciar sesión: '+ e.code + ' | ' + e.message);
    }
  }
  async function doLogout(){
    try{
      await firebase.auth().signOut();
    }catch(e){
      console.error('Logout error', e);
    }
  }

  /* ---------- Carga agregada ---------- */
  async function cargarUsuarios(el){
    const rootPath = el.getAttribute('data-root') || 'TiempoDuranteSesion';
    el.textContent = 'Cargando…';
    try{
      await ensureFirebase();
      if (!firebase.auth().currentUser){
        el.textContent = 'Inicia sesión para ver los datos.';
        return;
      }
      const db = firebase.database();
      const snap = await db.ref(rootPath).get();
      if(!snap.exists()){ el.textContent='Sin datos'; return; }
      const tree = snap.val();

      datasetUsuarios = Object.entries(tree).map(([user, sesionesObj])=>{
        let total=0, sesiones=0;
        if (sesionesObj && typeof sesionesObj === 'object'){
          Object.entries(sesionesObj).forEach(([clave, valor])=>{
            const secs = extractSeconds(valor);
            if (secs != null){ total+=secs; sesiones++; }
          });
        }
        return { user, total, sesiones };
      }).sort((a,b)=> b.total - a.total);

      el.innerHTML = buildTablaUsuarios(datasetUsuarios);
      actualizarContador();

      // Clic en filas (detalle)
      el.querySelectorAll('tbody tr[data-fs-user]').forEach(tr=>{
        tr.style.cursor='pointer';
        tr.addEventListener('click', ()=>{
          const usuario = tr.getAttribute('data-fs-user');
          const ev = new CustomEvent('fsSeleccionUsuario',{ detail:{ usuario, root: rootPath }});
          document.dispatchEvent(ev);
        });
      });

      // Reaplicar filtro si hay texto
      const input = document.getElementById('fs-buscar-usuarios');
      if (input && input.value) filtrarUsuarios(input.value);

    }catch(e){
      console.error(e);
      el.textContent = 'Error: ' + e.message;
    }
  }

  /* ---------- Filtro / Buscador ---------- */
  function filtrarUsuarios(needle){
    const table = document.querySelector('#fs-usuarios table');
    if (!table) return 0;
    const rows = table.querySelectorAll('tbody tr');
    const q = (needle||'').trim().toLowerCase();
    let visibles = 0;
    rows.forEach(row=>{
      const user = row.getAttribute('data-fs-user') || '';
      if (!q || user.toLowerCase().includes(q)){ row.classList.remove('fs-row-hidden'); visibles++; }
      else { row.classList.add('fs-row-hidden'); }
    });
    actualizarContador(visibles);
    return visibles;
  }
  function actualizarContador(visibles){
    const span = document.getElementById('fs-count-usuarios');
    if (!span) return;
    const total = datasetUsuarios.length;
    if (typeof visibles === 'undefined') visibles = total;
    span.textContent = `${visibles} / ${total}`;
  }
  function initBuscador(){
    const input = document.getElementById('fs-buscar-usuarios');
    const clearBtn = document.querySelector('.fs-clear');
    if (!input) return;
    let lastVal = '';
    let timer = null;
    function apply(){ if (input.value===lastVal) return; lastVal=input.value; filtrarUsuarios(lastVal); }
    input.addEventListener('input', ()=>{ clearTimeout(timer); timer=setTimeout(apply, 120); });
    input.addEventListener('keydown', (e)=>{
      if (e.key==='Enter'){
        const visibles = filtrarUsuarios(input.value);
        if (visibles===1){
          const row = document.querySelector('#fs-usuarios tbody tr:not(.fs-row-hidden)');
          if (row) row.click();
        }
      }
    });
    if (clearBtn){ clearBtn.addEventListener('click', ()=>{ input.value=''; filtrarUsuarios(''); input.focus(); }); }
  }

  /* ---------- Detalle ---------- */
  async function cargarDetalle(el){
    const rootPath = el.getAttribute('data-root') || 'TiempoDuranteSesion';
    const usuario  = el.getAttribute('data-user');
    el.textContent = 'Cargando…';
    if(!usuario){ el.textContent='Falta usuario'; return; }
    try{
      await ensureFirebase();
      if (!firebase.auth().currentUser){
        el.textContent = 'Inicia sesión para ver el detalle.';
        return;
      }
      const db = firebase.database();
      const snap = await db.ref(`${rootPath}/${usuario}`).get();
      if(!snap.exists()){ el.textContent='Sin sesiones'; return; }
      const sesionesObj = snap.val();

      const sesiones = Object.entries(sesionesObj).map(([k,val])=>{
        const secs = extractSeconds(val);
        return { key:k, seconds:secs, hms: secs!=null?toHMS(secs):'' };
      }).filter(s=>s.seconds!=null)
        .sort((a,b)=> a.key.localeCompare(b.key,'es'));

      const total = sesiones.reduce((s,r)=> s + (r.seconds||0),0);

      let html = '<div class="fs-resumen-detalle">';
      html += `<div><strong>Usuario:</strong> ${usuario}</div>`;
      html += `<div><strong>Sesiones:</strong> ${sesiones.length}</div>`;
      html += `<div><strong>Total:</strong> ${toHMS(total)}</div>`;
      html += '</div>';

      html += '<table class="fs-tabla"><thead><tr><th>Clave</th><th>Tiempo</th></tr></thead><tbody>';
      sesiones.forEach(s=>{ html += `<tr><td>${s.key}</td><td class="right">${s.hms}</td></tr>`; });
      html += '</tbody></table>';

      el.innerHTML = html;

    }catch(e){
      console.error(e);
      el.textContent = 'Error: ' + e.message;
    }
  }

  /* ---------- Init global ---------- */
  async function init(){
    initBuscador();
    await ensureFirebase();

    // Botones login/logout
    const btnLogin = document.getElementById('fs-login');
    const btnLogout = document.getElementById('fs-logout');
    if (btnLogin) btnLogin.addEventListener('click', doLogin);
    if (btnLogout) btnLogout.addEventListener('click', doLogout);

    // Suscripción a cambios de sesión
    authUnsub = firebase.auth().onAuthStateChanged(async (user)=>{
      log('Auth state:', user ? user.uid : null);
      if (user){
        setAuthUI('in');
        // Cargar datos
        document.querySelectorAll('#fs-usuarios').forEach(el=>cargarUsuarios(el));
        document.querySelectorAll('#fs-detalle').forEach(el=>cargarDetalle(el));
      }else{
        setAuthUI('out');
      }
    });

    // Si ya hay sesión previa (persistencia por defecto), onAuthStateChanged disparará solo.
  }

  document.addEventListener('DOMContentLoaded', init);
})();
