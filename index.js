/**
 * @typedef {object} PathItem
 * @property {"Dir"|"SymlinkDir"|"File"|"SymlinkFile"} path_type
 * @property {string} name
 * @property {number} mtime
 * @property {number} size
 */

/**
 * @typedef {object} DATA
 * @property {string} href
 * @property {string} uri_prefix
 * @property {"Index" | "Edit" | "View"} kind
 * @property {PathItem[]} paths
 * @property {boolean} allow_upload
 * @property {boolean} allow_delete
 * @property {boolean} allow_search
 * @property {boolean} allow_archive
 * @property {boolean} auth
 * @property {string} user
 * @property {boolean} dir_exists
 * @property {string} editable
 */

const DUFS_MAX_UPLOADINGS = 1;

const THEME_STORAGE_KEY = "dufs-theme";

/**
 * @type {DATA} DATA
 */
let DATA;

function getStoredThemeMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  } catch {
    return "auto";
  }
}

function setupThemeSwitcher() {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  let mode = getStoredThemeMode();

  const applyTheme = () => {
    const isDark = mode === "dark" || (mode === "auto" && media.matches);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
    document.documentElement.dataset.themeMode = mode;
    document.querySelectorAll("[data-theme-cycle]").forEach(button => {
      const label = `Theme: ${mode}`;
      button.setAttribute("aria-label", label);
      button.title = label;
    });
    document.querySelectorAll("[data-theme-toggle]").forEach(button => {
      const active = button.dataset.themeToggle === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  };

  const onChange = () => {
    if (mode === "auto") {
      applyTheme();
    }
  };

  media.addEventListener("change", onChange);

  document.querySelectorAll("[data-theme-toggle]").forEach(button => {
    button.addEventListener("click", () => {
      mode = button.dataset.themeToggle;
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch { }
      applyTheme();
    });
  });

  // compact switch for phones: one button that cycles auto -> light -> dark
  const modes = ["auto", "light", "dark"];
  document.querySelectorAll("[data-theme-cycle]").forEach(button => {
    button.addEventListener("click", () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      try {
        localStorage.setItem(THEME_STORAGE_KEY, mode);
      } catch { }
      applyTheme();
    });
  });

  applyTheme();
}

/**
 * @type {string}
 */
let DIR_EMPTY_NOTE;

/**
 * @type {PARAMS}
 * @typedef {object} PARAMS
 * @property {string} q
 * @property {string} sort
 * @property {string} order
 */
const PARAMS = Object.fromEntries(new URLSearchParams(window.location.search));

const IFRAME_FORMATS = [
  ".pdf",
  ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".svg",
  ".mp4", ".mov", ".avi", ".wmv", ".flv", ".webm",
  ".mp3", ".ogg", ".wav", ".m4a",
];

const MAX_SUBPATHS_COUNT = 1000;

const ICONS = {
  dir: `<svg height="16" viewBox="0 0 14 16" width="14"><path fill-rule="evenodd" d="M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM6 4H1V3h5v1z"></path></svg>`,
  symlinkFile: `<svg height="16" viewBox="0 0 12 16" width="12"><path fill-rule="evenodd" d="M8.5 1H1c-.55 0-1 .45-1 1v12c0 .55.45 1 1 1h10c.55 0 1-.45 1-1V4.5L8.5 1zM11 14H1V2h7l3 3v9zM6 4.5l4 3-4 3v-2c-.98-.02-1.84.22-2.55.7-.71.48-1.19 1.25-1.45 2.3.02-1.64.39-2.88 1.13-3.73.73-.84 1.69-1.27 2.88-1.27v-2H6z"></path></svg>`,
  symlinkDir: `<svg height="16" viewBox="0 0 14 16" width="14"><path fill-rule="evenodd" d="M13 4H7V3c0-.66-.31-1-1-1H1c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1V5c0-.55-.45-1-1-1zM1 3h5v1H1V3zm6 9v-2c-.98-.02-1.84.22-2.55.7-.71.48-1.19 1.25-1.45 2.3.02-1.64.39-2.88 1.13-3.73C4.86 8.43 5.82 8 7.01 8V6l4 3-4 3H7z"></path></svg>`,
  file: `<svg height="16" viewBox="0 0 12 16" width="12"><path fill-rule="evenodd" d="M6 5H2V4h4v1zM2 8h7V7H2v1zm0 2h7V9H2v1zm0 2h7v-1H2v1zm10-7.5V14c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V2c0-.55.45-1 1-1h7.5L12 4.5zM11 5L8 2H1v12h10V5z"></path></svg>`,
  download: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg>`,
  move: `<svg width="16" height="16" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M1.5 1.5A.5.5 0 0 0 1 2v4.8a2.5 2.5 0 0 0 2.5 2.5h9.793l-3.347 3.346a.5.5 0 0 0 .708.708l4.2-4.2a.5.5 0 0 0 0-.708l-4-4a.5.5 0 0 0-.708.708L13.293 8.3H3.5A1.5 1.5 0 0 1 2 6.8V2a.5.5 0 0 0-.5-.5z"/></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6zM2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/></svg>`,
  delete: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M6.854 7.146a.5.5 0 1 0-.708.708L7.293 9l-1.147 1.146a.5.5 0 0 0 .708.708L8 9.707l1.146 1.147a.5.5 0 0 0 .708-.708L8.707 9l1.147-1.146a.5.5 0 0 0-.708-.708L8 8.293 6.854 7.146z"/><path d="M14 14V4.5L9.5 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2zM9.5 3A1.5 1.5 0 0 0 11 4.5h2V14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h5.5v2z"/></svg>`,
  view: `<svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 1h8a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1"/></svg>`,
}

/**
 * @type Map<string, Uploader>
 */
const failUploaders = new Map();

/**
 * @type Element
 */
let $pathsTable;
/**
 * @type Element
 */
let $pathsTableHead;
/**
 * @type Element
 */
let $pathsTableBody;
/**
 * @type Element
 */
let $uploadersTable;
/**
 * @type Element
 */
let $emptyFolder;
/**
 * @type Element
 */
let $editor;
/**
 * @type Element
 */
let $loginBtn;

const beforeUnloadHandler = (event) => {
  if (Uploader.queues.length > 0 || Uploader.runnings > 0) {
    event.preventDefault();
    event.returnValue = '';
    return '';
  }
};

window.addEventListener("DOMContentLoaded", async () => {
  setupThemeSwitcher();

  const $indexData = document.getElementById('index-data');
  if (!$indexData) {
    alert("No data");
    return;
  }

  DATA = JSON.parse(decodeBase64($indexData.innerHTML));
  DIR_EMPTY_NOTE = PARAMS.q ? 'No results' : DATA.dir_exists ? 'Empty folder' : 'Folder will be created when a file is uploaded';

  await ready();
});

async function ready() {
  $pathsTable = document.querySelector(".paths-table");
  $pathsTableHead = document.querySelector(".paths-table thead");
  $pathsTableBody = document.querySelector(".paths-table tbody");
  $uploadersTable = document.querySelector(".uploaders-table");
  $emptyFolder = document.querySelector(".empty-folder");
  $editor = document.querySelector(".editor");
  $loginBtn = document.querySelector(".login-btn");

  setupUpButton();

  window.addEventListener('beforeunload', beforeUnloadHandler);

  addBreadcrumb(DATA.href, DATA.uri_prefix);
  setupToolboxMobileMenu();

  if (DATA.kind === "Index") {
    document.title = `Index of ${DATA.href} - Dufs`;
    document.querySelector(".index-page").classList.remove("hidden");

    await setupIndexPage();
  } else if (DATA.kind === "Edit") {
    document.title = `Edit ${DATA.href} - Dufs`;
    document.querySelector(".editor-page").classList.remove("hidden");

    await setupEditorPage();
  } else if (DATA.kind === "View") {
    document.title = `View ${DATA.href} - Dufs`;
    document.querySelector(".editor-page").classList.remove("hidden");

    await setupEditorPage();
  }
}

class Uploader {
  /**
   *
   * @param {File} file
   * @param {string[]} pathParts
   */
  constructor(file, pathParts) {
    /**
     * @type Element
     */
    this.$uploadStatus = null
    this.uploaded = 0;
    this.uploadOffset = 0;
    this.lastUptime = 0;
    this.name = [...pathParts, file.name].join("/");
    this.idx = Uploader.globalIdx++;
    this.file = file;
    this.url = newUrl(this.name);
  }

  upload() {
    const { idx, name, url } = this;
    const encodedName = encodedStr(name);
    $uploadersTable.insertAdjacentHTML("beforeend", `
  <tr id="upload${idx}" class="uploader">
    <td class="path cell-name">
      <span class="path-content">
        ${getPathSvg()}
        <a href="${url}">${encodedName}</a>
      </span>
    </td>
    <td class="cell-status upload-status" id="uploadStatus${idx}"></td>
  </tr>`);
    $uploadersTable.classList.remove("hidden");
    $emptyFolder.classList.add("hidden");
    this.$uploadStatus = document.getElementById(`uploadStatus${idx}`);
    this.$uploadStatus.innerHTML = '-';
    this.$uploadStatus.addEventListener("click", e => {
      const nodeId = e.target.id;
      const matches = /^retry(\d+)$/.exec(nodeId);
      if (matches) {
        const id = parseInt(matches[1]);
        let uploader = failUploaders.get(id);
        if (uploader) uploader.retry();
      }
    });
    Uploader.queues.push(this);
    Uploader.runQueue();
  }

  ajax() {
    const { url } = this;

    this.uploaded = 0;
    this.lastUptime = Date.now();

    const ajax = new XMLHttpRequest();
    ajax.upload.addEventListener("progress", e => this.progress(e), false);
    ajax.addEventListener("readystatechange", () => {
      if (ajax.readyState === 4) {
        if (ajax.status >= 200 && ajax.status < 300) {
          this.complete();
        } else {
          if (ajax.status !== 0) {
            this.fail(`${ajax.status} ${ajax.statusText}`);
          }
        }
      }
    })
    ajax.addEventListener("error", () => this.fail(), false);
    ajax.addEventListener("abort", () => this.fail(), false);
    if (this.uploadOffset > 0) {
      ajax.open("PATCH", url);
      ajax.setRequestHeader("X-Update-Range", "append");
      ajax.send(this.file.slice(this.uploadOffset));
    } else {
      ajax.open("PUT", url);
      ajax.send(this.file);
    }
  }

  async retry() {
    const { url } = this;
    let res = await fetch(url, {
      method: "HEAD",
    });
    let uploadOffset = 0;
    if (res.status === 200) {
      let value = res.headers.get("content-length");
      uploadOffset = parseInt(value) || 0;
    }
    this.uploadOffset = uploadOffset;
    this.ajax();
  }

  progress(event) {
    const now = Date.now();
    const elapsed = now - this.lastUptime;
    
    if (elapsed < 300) return;
    
    const speed = (event.loaded - this.uploaded) / elapsed * 1000;
    const [speedValue, speedUnit] = formatFileSize(speed);
    const speedText = `${speedValue} ${speedUnit}/s`;
    const progress = formatPercent(((event.loaded + this.uploadOffset) / this.file.size) * 100);
    const duration = formatDuration((event.total - event.loaded) / speed);
    
    this.$uploadStatus.innerHTML = `<span style="width: 80px;">${speedText}</span><span style="margin-left: 5px;">${progress} ${duration}</span>`;
    this.uploaded = event.loaded;
    this.lastUptime = now;
  }

  complete() {
    const $uploadStatusNew = this.$uploadStatus.cloneNode(true);
    $uploadStatusNew.innerHTML = `✓`;
    this.$uploadStatus.parentNode.replaceChild($uploadStatusNew, this.$uploadStatus);
    this.$uploadStatus = null;
    failUploaders.delete(this.idx);
    Uploader.runnings--;
    Uploader.runQueue();
  }

  fail(reason = "") {
    this.$uploadStatus.innerHTML = `<span style="width: 20px;" title="${reason}">✗</span><span class="retry-btn" id="retry${this.idx}" title="Retry">↻</span>`;
    failUploaders.set(this.idx, this);
    Uploader.runnings--;
    Uploader.runQueue();
  }
}

Uploader.globalIdx = 0;

Uploader.runnings = 0;

Uploader.auth = false;

/**
 * @type Uploader[]
 */
Uploader.queues = [];


Uploader.runQueue = async () => {
  if (Uploader.runnings >= DUFS_MAX_UPLOADINGS) return;
  if (Uploader.queues.length === 0) return;
  Uploader.runnings++;
  let uploader = Uploader.queues.shift();
  if (!Uploader.auth) {
    Uploader.auth = true;
    try {
      await checkAuth();
    } catch {
      Uploader.auth = false;
    }
  }
  uploader.ajax();
}

/**
 * Add breadcrumb
 * @param {string} href
 * @param {string} uri_prefix
 */
function addBreadcrumb(href, uri_prefix) {
  const $breadcrumb = document.querySelector(".breadcrumb");
  let parts = [];
  if (href === "/") {
    parts = [""];
  } else {
    parts = href.split("/");
  }
  const len = parts.length;
  let path = uri_prefix;
  for (let i = 0; i < len; i++) {
    const name = parts[i];
    if (i > 0) {
      if (!path.endsWith("/")) {
        path += "/";
      }
      path += encodeURIComponent(name);
    }
    const encodedName = encodedStr(name);
    if (i === 0) {
      $breadcrumb.insertAdjacentHTML("beforeend", `<a href="${path}" title="Root"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M6.5 14.5v-3.505c0-.245.25-.495.5-.495h2c.25 0 .5.25.5.5v3.5a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.146-.354L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293L8.354 1.146a.5.5 0 0 0-.708 0l-6 6A.5.5 0 0 0 1.5 7.5v7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5z"/></svg></a>`);
    } else if (i === len - 1) {
      $breadcrumb.insertAdjacentHTML("beforeend", `<b>${encodedName}</b>`);
    } else {
      $breadcrumb.insertAdjacentHTML("beforeend", `<a href="${path}">${encodedName}</a>`);
    }
    if (i !== len - 1) {
      $breadcrumb.insertAdjacentHTML("beforeend", `<span class="separator">/</span>`);
    }
  }
}

async function setupIndexPage() {
  if (DATA.allow_archive) {
    const $download = document.querySelector(".download");
    $download.href = baseUrl() + "?zip";
    $download.title = "Download folder as a .zip file";
    $download.classList.add("dlwt");
    $download.classList.remove("hidden");
  }

  if (DATA.allow_upload) {
    setupDropzone();
    setupUploadFile();
    setupNewFolder();
    setupNewFile();
  }

  if (DATA.auth) {
    await setupAuth();
  }

  if (DATA.allow_search) {
    setupSearch();
  }

  renderPathsTableHead();
  renderPathsTableBody();
  setupPathActionHandlers();
  if (DATA.allow_delete && DATA.allow_upload) {
    setupMoveDragDrop();
  }
  setupCellActionsMenus();

  if (DATA.user) {
    setupDownloadWithToken();
  }

}

/**
 * Render path table thead
 */
function renderPathsTableHead() {
  const headerItems = [
    {
      name: "name",
      props: ``,
      text: "Name",
    },
    {
      name: "mtime",
      props: ``,
      text: "Last Modified",
    },
    {
      name: "size",
      props: ``,
      text: "Size",
    }
  ];
  $pathsTableHead.insertAdjacentHTML("beforeend", `
    <tr>
      ${headerItems.map(item => {
    let svg = `<svg width="12" height="12" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M11.5 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L11 2.707V14.5a.5.5 0 0 0 .5.5zm-7-14a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L4 13.293V1.5a.5.5 0 0 1 .5-.5z"/></svg>`;
    let order = "desc";
    if (PARAMS.sort === item.name) {
      if (PARAMS.order === "desc") {
        order = "asc";
        svg = `<svg width="12" height="12" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/></svg>`
      } else {
        svg = `<svg width="12" height="12" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/></svg>`
      }
    }
    const qs = new URLSearchParams({ ...PARAMS, order, sort: item.name }).toString();
    const icon = `<span>${svg}</span>`
    return `<th class="cell-${item.name}" ${item.props}><a href="?${qs}">${item.text}${icon}</a></th>`
  }).join("\n")}
      <th class="cell-actions">Actions</th>
    </tr>
  `);
}

/**
 * Render path table tbody
 */
function renderPathsTableBody() {
  if (DATA.paths && DATA.paths.length > 0) {
    const len = DATA.paths.length;
    if (len > 0) {
      $pathsTable.classList.remove("hidden");
    }
    for (let i = 0; i < len; i++) {
      addPath(DATA.paths[i], i);
    }
  } else {
    $emptyFolder.textContent = DIR_EMPTY_NOTE;
    $emptyFolder.classList.remove("hidden");
  }
}

/**
 * Add pathitem
 * @param {PathItem} file
 * @param {number} index
 */
function addPath(file, index) {
  const encodedName = encodedStr(file.name);
  let url = newUrl(file.name);
  let actionDelete = "";
  let actionDownload = "";
  let actionMove = "";
  let actionCopy = "";
  let actionEdit = "";
  let actionView = "";
  let canMove = false;
  let isDir = file.path_type.endsWith("Dir");
  if (isDir) {
    url += "/";
    if (DATA.allow_archive) {
      actionDownload = `
      <div class="action-btn">
        <a class="dlwt" href="${url}?zip" title="Download folder as a .zip file" download>${ICONS.download}<span class="action-label">Download ZIP</span></a>
      </div>`;
    }
  } else {
    actionDownload = `
    <div class="action-btn" >
      <a class="dlwt" href="${url}" title="Download file" download>${ICONS.download}<span class="action-label">Download</span></a>
    </div>`;
  }
  if (DATA.allow_delete) {
    if (DATA.allow_upload) {
      canMove = true;
      actionMove = `<div class="action-btn" data-path-action="move" data-index="${index}" title="Move & Rename">${ICONS.move}<span class="action-label">Move</span></div>`;
      if (!isDir) {
        actionEdit = `<a class="action-btn" title="Edit file" target="_blank" href="${url}?edit">${ICONS.edit}<span class="action-label">Edit</span></a>`;
      }
    }
    actionDelete = `
    <div class="action-btn" data-path-action="delete" data-index="${index}" title="Delete">${ICONS.delete}<span class="action-label">Delete</span></div>`;
  }
  if (DATA.allow_upload) {
    actionCopy = `<div class="action-btn" data-path-action="copy" data-index="${index}" title="Copy">${ICONS.copy}<span class="action-label">Copy</span></div>`;
  }
  if (!actionEdit && !isDir) {
    actionView = `<a class="action-btn" title="View file" target="_blank" href="${url}?view">${ICONS.view}<span class="action-label">View</span></a>`;
  }

  const actionItems = [actionDownload, actionView, actionMove, actionCopy, actionDelete, actionEdit].filter(Boolean);
  const actionButtons = actionItems.join("");

  let actionCell = `
  <td class="cell-actions">
    <div class="cell-actions-desktop">
      ${actionButtons}
    </div>
    <div class="cell-actions-dropdown">
      <button type="button" class="cell-actions-toggle" aria-label="Open actions" aria-expanded="false" title="More actions">
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 4.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm0 5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm0 5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z"/></svg>
      </button>
      <div class="cell-actions-menu">
        ${actionItems.map(action => `<div class="action-item">${action}</div>`).join("")}
      </div>
    </div>
  </td>`;

  let sizeDisplay = isDir ? formatDirSize(file.size) : formatFileSize(file.size).join(" ");

  $pathsTableBody.insertAdjacentHTML("beforeend", `
<tr id="addPath${index}"${canMove ? ` draggable="true" data-move-index="${index}"` : ""}>
  <td class="path cell-name">
    <span class="path-content">
      ${getPathSvg(file.path_type)}
      <a href="${url}" ${isDir ? "" : `target="_blank"`}>${encodedName}</a>
    </span>
  </td>
  <td class="cell-mtime">${formatMtime(file.mtime)}</td>
  <td class="cell-size">${sizeDisplay}</td>
  ${actionCell}
</tr>`);
}

function setupPathActionHandlers() {
  if (document.body.dataset.pathActionHandlersBound === "true") return;

  document.body.addEventListener("click", (event) => {
    const actionNode = event.target.closest("[data-path-action]");
    if (!actionNode) return;

    const { pathAction, index } = actionNode.dataset;

    if (pathAction === "move") {
      movePath(Number(index));
      return;
    }

    if (pathAction === "copy") {
      copyPath(Number(index));
      return;
    }

    if (pathAction === "delete") {
      deletePath(Number(index));
    }
  });

  document.body.dataset.pathActionHandlersBound = "true";
}

/**
 * Header behaviour. The layout itself (grid areas per breakpoint) lives in index.css.
 * On narrow screens the toolbox buttons move into the hamburger menu,
 * and back again on wider screens.
 *
 * Keep this value in sync with the `@media (max-width: 680px)` header rules in index.css.
 */
const HEADER_MOBILE_QUERY = "(max-width: 680px)";

function setupToolboxMobileMenu() {
  const $toolbox = document.querySelector(".toolbox");
  const $toolboxMobile = document.querySelector(".toolbox-mobile");
  const $menu = document.querySelector(".toolbox-mobile-menu");
  const $trigger = document.querySelector(".toolbox-mobile-trigger");
  if (!$toolbox || !$toolboxMobile || !$menu || !$trigger) return;

  // Keyboard access: most header controls are <div>s.
  document.querySelectorAll(".toolbox div.control, .login-btn, .save-btn").forEach($el => {
    $el.setAttribute("role", "button");
    $el.tabIndex = 0;
    if (!$el.getAttribute("aria-label") && $el.title) {
      $el.setAttribute("aria-label", $el.title);
    }
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const $el = e.target;
    if (!$el.matches || !$el.matches('div[role="button"]')) return;
    e.preventDefault();
    if ($el.classList.contains("upload-file")) {
      document.getElementById("file")?.click();
    } else {
      $el.click();
    }
  });

  const media = window.matchMedia(HEADER_MOBILE_QUERY);

  const isOpen = () => $menu.classList.contains("is-open");

  const setOpen = (open, restoreFocus = false) => {
    $menu.classList.toggle("is-open", open);
    $trigger.setAttribute("aria-expanded", String(open));
    if (!open && restoreFocus) $trigger.focus();
  };

  const closeRowMenus = () => {
    document.querySelectorAll(".cell-actions-menu").forEach(menu => {
      menu.classList.remove("is-open");
      menu.classList.remove("menu-up");
    });
    document.querySelectorAll(".cell-actions-toggle").forEach(toggle => {
      toggle.setAttribute("aria-expanded", "false");
    });
  };

  // Move controls between the toolbox and the overflow menu depending on the breakpoint.
  const layout = () => {
    if (media.matches) {
      Array.from($toolbox.children).forEach(control => $menu.appendChild(control));
    } else {
      setOpen(false);
      Array.from($menu.children).forEach(control => $toolbox.appendChild(control));
    }
    // keep the current folder visible in the (scrollable) mobile breadcrumb
    const $breadcrumb = document.querySelector(".breadcrumb");
    if ($breadcrumb) $breadcrumb.scrollLeft = $breadcrumb.scrollWidth;
  };

  $trigger.setAttribute("aria-haspopup", "true");
  $trigger.setAttribute("aria-expanded", "false");

  $trigger.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    closeRowMenus();
    setOpen(!isOpen());
  });

  // Picking an action closes the menu.
  $menu.addEventListener("click", event => {
    if (event.target.closest(".control:not(.upload-file)")) setOpen(false);
  });
  $menu.addEventListener("change", () => setOpen(false));

  document.addEventListener("click", event => {
    if (!event.target.closest(".toolbox-mobile")) setOpen(false);
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && isOpen()) {
      setOpen(false, true);
    }
  });

  if (media.addEventListener) {
    media.addEventListener("change", layout);
  } else {
    media.addListener(layout);
  }
  layout();
}

function setupCellActionsMenus() {
  const dropdowns = document.querySelectorAll(".cell-actions-dropdown");

  dropdowns.forEach(dropdown => {
    const toggle = dropdown.querySelector(".cell-actions-toggle");
    const menu = dropdown.querySelector(".cell-actions-menu");

    if (!toggle || !menu) return;

    toggle.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();

      const $toolboxMobileMenu = document.querySelector(".toolbox-mobile-menu");
      const $toolboxTrigger = document.querySelector(".toolbox-mobile-trigger");

      if ($toolboxMobileMenu) {
        $toolboxMobileMenu.classList.remove("is-open");
      }
      if ($toolboxTrigger) {
        $toolboxTrigger.setAttribute("aria-expanded", "false");
      }

      const shouldOpen = !menu.classList.contains("is-open");

      dropdowns.forEach(item => {
        const itemMenu = item.querySelector(".cell-actions-menu");
        const itemToggle = item.querySelector(".cell-actions-toggle");
        const isCurrent = item === dropdown;

        if (itemMenu) {
          itemMenu.classList.toggle("is-open", isCurrent && shouldOpen);
          itemMenu.classList.remove("menu-up");

          if (isCurrent && shouldOpen) {
            const menuRect = itemMenu.getBoundingClientRect();
            const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
            const overflowBottom = menuRect.bottom > viewportHeight - 12;

            if (overflowBottom) {
              itemMenu.classList.add("menu-up");
            }
          }
        }

        if (itemToggle) {
          itemToggle.setAttribute("aria-expanded", String(isCurrent && shouldOpen));
        }
      });
    });
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".cell-actions-dropdown")) {
      document.querySelectorAll(".cell-actions-menu").forEach(menu => {
        menu.classList.remove("is-open");
        menu.classList.remove("menu-up");
      });
      document.querySelectorAll(".cell-actions-toggle").forEach(toggle => {
        toggle.setAttribute("aria-expanded", "false");
      });
    }
  });
}

function setupDropzone() {
  // Note: "dragstart" must not be cancelled here, otherwise rows can never be dragged (move).
  ["drag", "dragend", "dragover", "dragenter", "dragleave", "drop"].forEach(name => {
    document.addEventListener(name, e => {
      // Internal row drags (move) are handled by setupMoveDragDrop.
      if (Array.from(e.dataTransfer?.types || []).includes(DND_MOVE_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
    });
  });
  document.addEventListener("drop", async e => {
    // Internal row drags (move) are handled by setupMoveDragDrop, not uploaded.
    if (Array.from(e.dataTransfer.types || []).includes(DND_MOVE_TYPE)) return;
    if (!e.dataTransfer.items || !e.dataTransfer.items[0]) return;
    if (!e.dataTransfer.items[0].webkitGetAsEntry) {
      const files = Array.from(e.dataTransfer.files).filter(v => v.size > 0);
      for (const file of files) {
        new Uploader(file, []).upload();
      }
    } else {
      const entries = [];
      const len = e.dataTransfer.items.length;
      for (let i = 0; i < len; i++) {
        entries.push(e.dataTransfer.items[i].webkitGetAsEntry());
      }
      addFileEntries(entries, []);
    }
  });
}

async function setupAuth() {
  if (DATA.user) {
    return;
  }

  $loginBtn.classList.remove("hidden");
  $loginBtn.addEventListener("click", async () => {
    try {
      await checkAuth("login");
    } catch { }
    location.reload();
  });
}

function setupDownloadWithToken() {
  document.querySelectorAll("a.dlwt").forEach(link => {
    link.addEventListener("click", async e => {
      e.preventDefault();
      try {
        const link = e.currentTarget || e.target;
        const originalHref = link.getAttribute("href");
        const tokengenUrl = new URL(originalHref);
        tokengenUrl.searchParams.set("tokengen", "");
        const res = await fetch(tokengenUrl);
        if (!res.ok) throw new Error("Failed to fetch token");
        const token = await res.text();
        const downloadUrl = new URL(originalHref);
        downloadUrl.searchParams.set("token", token);
        const tempA = document.createElement("a");
        tempA.href = downloadUrl.toString();
        tempA.download = "";
        document.body.appendChild(tempA);
        tempA.click();
        document.body.removeChild(tempA);
      } catch (err) {
        alert(`Failed to download, ${err.message}`);
      }
    });
  });
}

function setupUpButton() {
  const $upButton = document.querySelector(".up-button");
  if (!$upButton) return;

  const currentPath = location.pathname.replace(/\/+$/, "") || "/";
  const segments = currentPath.split("/").filter(Boolean);

  if (segments.length === 0) {
    $upButton.classList.add("hidden");
    $upButton.removeAttribute("href");
    return;
  }

  const parentSegments = segments.slice(0, -1);
  const parentPath = parentSegments.length > 0 ? `/${parentSegments.join("/")}/` : "/";

  $upButton.href = parentPath;
  $upButton.classList.remove("hidden");
}

function setupSearch() {
  const $searchbar = document.querySelector(".searchbar");
  $searchbar.classList.remove("hidden");
  $searchbar.addEventListener("submit", event => {
    event.preventDefault();
    const formData = new FormData($searchbar);
    const q = formData.get("q");
    let href = baseUrl();
    if (q) {
      href += "?q=" + q;
    }
    location.href = href;
  });
  if (PARAMS.q) {
    document.getElementById('search').value = PARAMS.q;
  }
}

function setupUploadFile() {
  document.querySelector(".upload-file").classList.remove("hidden");
  document.getElementById("file").addEventListener("change", async e => {
    const files = e.target.files;
    for (let file of files) {
      new Uploader(file, []).upload();
    }
  });
}

function setupNewFolder() {
  const $newFolder = document.querySelector(".new-folder");
  $newFolder.classList.remove("hidden");
  $newFolder.addEventListener("click", () => {
    const name = prompt("Enter folder name");
    if (name) createFolder(name);
  });
}

function setupNewFile() {
  const $newFile = document.querySelector(".new-file");
  $newFile.classList.remove("hidden");
  $newFile.addEventListener("click", () => {
    const name = prompt("Enter file name");
    if (name) createFile(name);
  });
}

async function setupEditorPage() {
  const url = baseUrl();

  const $download = document.querySelector(".download");
  $download.classList.remove("hidden");
  $download.href = url;

  if (DATA.kind === "Edit") {
    const $moveFile = document.querySelector(".move-file");
    $moveFile.classList.remove("hidden");
    $moveFile.addEventListener("click", async () => {
      const query = location.href.slice(url.length);
      const newFileUrl = await doMovePath(url);
      if (newFileUrl) {
        location.href = newFileUrl + query;
      }
    });

    const $copyFile = document.querySelector(".copy-file");
    $copyFile.classList.remove("hidden");
    $copyFile.addEventListener("click", async () => {
      const newFileUrl = await doCopyPath(url);
      if (newFileUrl) {
        showToast(`Copied to ${urlToPath(newFileUrl)}`, newFileUrl + "?edit");
      }
    });

    const $deleteFile = document.querySelector(".delete-file");
    $deleteFile.classList.remove("hidden");
    $deleteFile.addEventListener("click", async () => {
      const url = baseUrl();
      const name = baseName(url);
      await doDeletePath(name, url, () => {
        location.href = location.href.split("/").slice(0, -1).join("/");
      });
    });

    if (DATA.editable) {
      const $saveBtn = document.querySelector(".save-btn");
      $saveBtn.classList.remove("hidden");
      $saveBtn.addEventListener("click", saveChange);
    }
  } else if (DATA.kind === "View") {
    $editor.readonly = true;
  }

  if (!DATA.editable) {
    const $notEditable = document.querySelector(".not-editable");
    const url = baseUrl();
    const ext = extName(baseName(url));
    if (IFRAME_FORMATS.find(v => v === ext)) {
      $notEditable.insertAdjacentHTML("afterend", `<iframe src="${url}" sandbox width="100%" height="${window.innerHeight - 100}px"></iframe>`);
    } else {
      $notEditable.classList.remove("hidden");
      $notEditable.textContent = "Cannot edit because file is too large or binary.";
    }
    return;
  }

  $editor.classList.remove("hidden");
  try {
    const res = await fetch(baseUrl());
    await assertResOK(res);
    const encoding = getEncoding(res.headers.get("content-type"));
    if (encoding === "utf-8") {
      $editor.value = await res.text();
    } else {
      const bytes = await res.arrayBuffer();
      const dataView = new DataView(bytes);
      const decoder = new TextDecoder(encoding);
      $editor.value = decoder.decode(dataView);
    }
  } catch (err) {
    alert(`Failed to get file, ${err.message}`);
  }
}

/**
 * Delete path
 * @param {number} index
 * @returns
 */
async function deletePath(index) {
  const file = DATA.paths[index];
  if (!file) return;
  await doDeletePath(file.name, newUrl(file.name), () => removePathRow(index));
}

/**
 * Remove a row from the table after it was deleted or moved away
 * @param {number} index
 */
function removePathRow(index) {
  document.getElementById(`addPath${index}`)?.remove();
  DATA.paths[index] = null;
  if (!DATA.paths.find(v => !!v)) {
    $pathsTable.classList.add("hidden");
    $emptyFolder.textContent = DIR_EMPTY_NOTE;
    $emptyFolder.classList.remove("hidden");
  }
}

async function doDeletePath(name, url, cb) {
  if (!confirm(`Delete \`${name}\`?`)) return;
  try {
    await checkAuth();
    const res = await fetch(url, {
      method: "DELETE",
    });
    await assertResOK(res);
    cb();
  } catch (err) {
    alert(`Cannot delete \`${name}\`, ${err.message}`);
  }
}

/**
 * Move path (opens the folder picker)
 * @param {number} index
 * @returns
 */
async function movePath(index) {
  const file = DATA.paths[index];
  if (!file) return;
  const fileUrl = newUrl(file.name);
  const newFileUrl = await doMovePath(fileUrl, file.path_type.endsWith("Dir"));
  if (newFileUrl) {
    afterMove(index, urlToPath(newFileUrl));
  }
}

/**
 * Copy path (opens the folder picker)
 * @param {number} index
 */
async function copyPath(index) {
  const file = DATA.paths[index];
  if (!file) return;
  const fileUrl = newUrl(file.name);
  const newFileUrl = await doCopyPath(fileUrl, file.path_type.endsWith("Dir"));
  if (newFileUrl) {
    afterCopy(urlToPath(newFileUrl));
  }
}

/**
 * Ask where to copy a path (folder picker), then copy it.
 * @param {string} fileUrl
 * @param {boolean} [isDir]
 * @returns {Promise<string|undefined>} the new url, if the path was copied
 */
async function doCopyPath(fileUrl, isDir = false) {
  const filePath = urlToPath(fileUrl);
  const newPath = await pickMoveDestination(filePath, isDir, true);
  if (!newPath) return;
  return await copyTo(fileUrl, newPath);
}

/**
 * Ask where to move a path (folder picker), then move it.
 * @param {string} fileUrl
 * @param {boolean} [isDir]
 * @returns {Promise<string|undefined>} the new url, if the path was moved
 */
async function doMovePath(fileUrl, isDir = false) {
  const filePath = urlToPath(fileUrl);
  const newPath = await pickMoveDestination(filePath, isDir);
  if (!newPath) return;
  return await moveTo(fileUrl, newPath);
}

/**
 * Move `fileUrl` to `newPath` with a WebDAV MOVE request.
 * @param {string} fileUrl
 * @param {string} newPath
 * @returns {Promise<string|undefined>} the new url, if the path was moved
 */
async function moveTo(fileUrl, newPath) {
  return await transferTo(fileUrl, newPath, "MOVE");
}

/**
 * Copy `fileUrl` to `newPath` with a WebDAV COPY request.
 * @param {string} fileUrl
 * @param {string} newPath
 * @returns {Promise<string|undefined>} the new url, if the path was copied
 */
async function copyTo(fileUrl, newPath) {
  return await transferTo(fileUrl, newPath, "COPY");
}

/**
 * Move or copy `fileUrl` to `newPath` with a WebDAV MOVE / COPY request.
 * @param {string} fileUrl
 * @param {string} newPath
 * @param {"MOVE"|"COPY"} method
 * @returns {Promise<string|undefined>} the new url, if the request succeeded
 */
async function transferTo(fileUrl, newPath, method) {
  const fileUrlObj = new URL(fileUrl);
  const prefix = DATA.uri_prefix.slice(0, -1);
  const filePath = urlToPath(fileUrl);

  if (!newPath.startsWith("/")) newPath = "/" + newPath;
  if (filePath === newPath) return;
  const newFileUrl = fileUrlObj.origin + prefix + newPath.split("/").map(encodeURIComponent).join("/");

  try {
    await checkAuth();
    const res1 = await fetch(newFileUrl, {
      method: "HEAD",
    });
    if (res1.status === 200) {
      if (!confirm("Override existing file?")) {
        return;
      }
    }
    const res2 = await fetch(fileUrl, {
      method,
      headers: {
        "Destination": newFileUrl,
      }
    });
    await assertResOK(res2);
    return newFileUrl;
  } catch (err) {
    alert(`Cannot ${method.toLowerCase()} \`${filePath}\` to \`${newPath}\`, ${err.message}`);
  }
}

/**
 * Update the page after the row `index` was moved to `newPath`.
 * @param {number} index
 * @param {string} newPath
 */
function afterMove(index, newPath) {
  const destDir = parentDir(newPath);
  if (destDir === currentDir() && !PARAMS.q) {
    // renamed inside the current folder
    location.reload();
    return;
  }
  removePathRow(index);
  showToast(`Moved to ${destDir}`, dirUrl(destDir));
}

/**
 * Update the page after a path was copied to `newPath`.
 * @param {string} newPath
 */
function afterCopy(newPath) {
  const destDir = parentDir(newPath);
  if (destDir === currentDir() && !PARAMS.q) {
    // copied inside the current folder
    location.reload();
    return;
  }
  showToast(`Copied to ${destDir}`, dirUrl(destDir));
}

/* ---------- path helpers ---------- */

/**
 * Convert an absolute url (or pathname) to a decoded path relative to uri_prefix
 * @param {string} url
 * @returns {string}
 */
function urlToPath(url) {
  const prefix = DATA.uri_prefix.slice(0, -1);
  const pathname = new URL(url, location.href).pathname;
  return decodeURIComponent(pathname.slice(prefix.length));
}

/**
 * Path of the folder shown on the current page ("/" for the root)
 */
function currentDir() {
  return urlToPath(location.pathname).replace(/\/+$/, "") || "/";
}

function joinPath(dir, name) {
  return dir === "/" ? "/" + name : dir + "/" + name;
}

function parentDir(path) {
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

/**
 * Url of a folder given as a decoded path
 * @param {string} dir
 */
function dirUrl(dir) {
  const prefix = DATA.uri_prefix.slice(0, -1);
  const encoded = dir === "/" ? "/" : dir.split("/").map(encodeURIComponent).join("/") + "/";
  return location.origin + prefix + encoded;
}

/* ---------- toast ---------- */

let toastTimer = null;

function showToast(text, href) {
  document.querySelector(".toast")?.remove();
  clearTimeout(toastTimer);
  const $toast = document.createElement("div");
  $toast.className = "toast";
  $toast.setAttribute("role", "status");
  const $text = document.createElement("span");
  $text.textContent = text;
  $toast.appendChild($text);
  if (href) {
    const $link = document.createElement("a");
    $link.href = href;
    $link.textContent = "Open";
    $toast.appendChild($link);
  }
  document.body.appendChild($toast);
  toastTimer = setTimeout(() => $toast.remove(), 6000);
}

/* ---------- drag & drop move ---------- */

const DND_MOVE_TYPE = "application/x-dufs-move";

/**
 * Drag a row onto a folder row, a breadcrumb segment or the "Parent" button to move it.
 */
function setupMoveDragDrop() {
  /** @type {number|null} */
  let dragIndex = null;
  /** @type {Element|null} */
  let activeTarget = null;

  const setActiveTarget = (node) => {
    if (activeTarget === node) return;
    activeTarget?.classList.remove("drop-target");
    activeTarget = node;
    activeTarget?.classList.add("drop-target");
  };

  const cleanup = () => {
    setActiveTarget(null);
    document.querySelectorAll("tr.dragging").forEach(row => row.classList.remove("dragging"));
    dragIndex = null;
  };

  /**
   * @returns {{node: Element, dir: string}|null}
   */
  const findTarget = (el) => {
    if (!el || !el.closest || dragIndex === null) return null;

    const row = el.closest("tr[data-move-index]");
    if (row) {
      const i = Number(row.dataset.moveIndex);
      const file = DATA.paths[i];
      if (i === dragIndex || !file || !file.path_type.endsWith("Dir")) return null;
      return { node: row, dir: joinPath(currentDir(), file.name) };
    }

    const link = el.closest(".breadcrumb a, .up-button");
    if (link && !link.classList.contains("hidden") && link.getAttribute("href")) {
      const dir = urlToPath(link.getAttribute("href")).replace(/\/+$/, "") || "/";
      return { node: link, dir };
    }
    return null;
  };

  document.addEventListener("dragstart", e => {
    const row = e.target.closest && e.target.closest("tr[data-move-index]");
    if (!row) return;
    dragIndex = Number(row.dataset.moveIndex);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DND_MOVE_TYPE, String(dragIndex));
    if (e.dataTransfer.setDragImage) {
      e.dataTransfer.setDragImage(row, 16, 16);
    }
    row.classList.add("dragging");
  });

  document.addEventListener("dragover", e => {
    if (dragIndex === null) return;
    const target = findTarget(e.target);
    setActiveTarget(target ? target.node : null);
    e.dataTransfer.dropEffect = target ? "move" : "none";
    if (target) e.preventDefault();
  });

  document.addEventListener("drop", async e => {
    if (dragIndex === null) return;
    const index = dragIndex;
    const target = findTarget(e.target);
    cleanup();
    e.preventDefault();
    if (!target) return;
    await moveIndexInto(index, target.dir);
  });

  document.addEventListener("dragend", cleanup);

  /* ----- touch: long-press a row, then drag it ----- */
  // Touch browsers don't fire HTML5 drag events reliably, so drag is emulated here.

  const LONG_PRESS_MS = 350;
  const MOVE_TOLERANCE = 10;
  const EDGE_SCROLL_ZONE = 70;

  /** @type {HTMLElement|null} */
  let touchRow = null;
  let touchTimer = null;
  let touchActive = false;
  let touchStart = { x: 0, y: 0 };
  let touchLast = { x: 0, y: 0 };
  /** @type {HTMLElement|null} */
  let ghost = null;
  let scrollTimer = null;

  const positionGhost = () => {
    if (ghost) ghost.style.transform = `translate(${touchLast.x + 14}px, ${touchLast.y - 24}px)`;
  };

  const cancelTouch = () => {
    clearTimeout(touchTimer);
    clearInterval(scrollTimer);
    touchTimer = null;
    scrollTimer = null;
    if (touchRow) touchRow.draggable = true;
    ghost?.remove();
    ghost = null;
    document.body.classList.remove("touch-dragging");
    touchActive = false;
    touchRow = null;
    cleanup();
  };

  const startTouchDrag = () => {
    touchTimer = null;
    if (!touchRow) return;
    touchActive = true;
    dragIndex = Number(touchRow.dataset.moveIndex);
    touchRow.classList.add("dragging");
    document.body.classList.add("touch-dragging");
    const file = DATA.paths[dragIndex];
    ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.textContent = file ? file.name.split("/").pop() : "";
    document.body.appendChild(ghost);
    positionGhost();
    if (navigator.vibrate) navigator.vibrate(15);
    scrollTimer = setInterval(() => {
      if (touchLast.y < EDGE_SCROLL_ZONE) {
        window.scrollBy(0, -14);
      } else if (touchLast.y > window.innerHeight - EDGE_SCROLL_ZONE) {
        window.scrollBy(0, 14);
      }
    }, 16);
  };

  document.addEventListener("touchstart", e => {
    if (touchRow) {
      // a second finger cancels the gesture
      cancelTouch();
      return;
    }
    if (e.touches.length !== 1) return;
    const row = e.target.closest && e.target.closest("tr[data-move-index]");
    if (!row || e.target.closest(".cell-actions")) return;
    touchRow = row;
    // turn off native drag for this touch so it can't compete with the emulation
    row.draggable = false;
    const t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
    touchLast = { x: t.clientX, y: t.clientY };
    touchTimer = setTimeout(startTouchDrag, LONG_PRESS_MS);
  }, { passive: true });

  document.addEventListener("touchmove", e => {
    if (!touchRow) return;
    const t = e.touches[0];
    touchLast = { x: t.clientX, y: t.clientY };
    if (!touchActive) {
      // finger moved before the long-press fired: the user is scrolling
      if (Math.hypot(t.clientX - touchStart.x, t.clientY - touchStart.y) > MOVE_TOLERANCE) {
        cancelTouch();
      }
      return;
    }
    e.preventDefault();
    positionGhost();
    const target = findTarget(document.elementFromPoint(t.clientX, t.clientY));
    setActiveTarget(target ? target.node : null);
  }, { passive: false });

  document.addEventListener("touchend", async e => {
    if (!touchRow) return;
    if (!touchActive) {
      cancelTouch();
      return;
    }
    const index = dragIndex;
    const t = e.changedTouches[0];
    const target = findTarget(document.elementFromPoint(t.clientX, t.clientY));
    // don't let the browser turn the release into a click on the link under the finger
    e.preventDefault();
    cancelTouch();
    if (index !== null && target) {
      await moveIndexInto(index, target.dir);
    }
  });

  document.addEventListener("touchcancel", () => {
    if (touchRow) cancelTouch();
  });

  document.addEventListener("contextmenu", e => {
    if (touchRow) e.preventDefault();
  });
}

/**
 * Move row `index` into folder `targetDir` (keeps the name)
 * @param {number} index
 * @param {string} targetDir
 */
async function moveIndexInto(index, targetDir) {
  const file = DATA.paths[index];
  if (!file) return;
  const name = file.name.split("/").pop();
  const srcPath = joinPath(currentDir(), file.name);
  const destPath = joinPath(targetDir, name);
  if (destPath === srcPath) return;
  if (file.path_type.endsWith("Dir") && (targetDir === srcPath || targetDir.startsWith(srcPath + "/"))) {
    alert(`Cannot move \`${srcPath}\` into itself`);
    return;
  }
  const newFileUrl = await moveTo(newUrl(file.name), destPath);
  if (newFileUrl) {
    afterMove(index, destPath);
  }
}

/* ---------- folder picker ---------- */

/**
 * Show a dialog to choose the destination folder (and optionally a new name).
 * @param {string} filePath current path of the item, e.g. "/a/b.txt"
 * @param {boolean} isDir whether the item is a folder
 * @param {boolean} [copy] copy instead of move
 * @returns {Promise<string|undefined>} the new full path, or undefined if cancelled
 */
function pickMoveDestination(filePath, isDir, copy = false) {
  return new Promise(resolve => {
    const origName = filePath.split("/").pop();
    const origDir = parentDir(filePath);
    const previousFocus = document.activeElement;
    let curDir = origDir;
    let dirs = [];
    let loadId = 0;
    let finished = false;

    const el = (tag, cls, text) => {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text != null) node.textContent = text;
      return node;
    };
    const button = (cls, text) => {
      const node = el("button", cls, text);
      node.type = "button";
      return node;
    };

    const $backdrop = el("div", "dlg-backdrop");
    const $dlg = el("div", "dlg");
    $dlg.setAttribute("role", "dialog");
    $dlg.setAttribute("aria-modal", "true");
    $dlg.setAttribute("aria-label", copy ? "Copy" : "Move & Rename");

    const $head = el("div", "dlg-head");
    const $title = el("div", "dlg-title", `${copy ? "Copy" : "Move"} \`${origName}\``);
    const $close = button("dlg-close", "×");
    $close.setAttribute("aria-label", "Close");
    $head.append($title, $close);

    const $crumbs = el("div", "dlg-crumbs");
    const $list = el("div", "dlg-list");

    const $foot = el("div", "dlg-foot");
    const $nameLabel = el("label", "dlg-name");
    const $nameText = el("span", "", "Name");
    const $name = el("input");
    $name.type = "text";
    $name.value = origName;
    $name.autocomplete = "off";
    $name.spellcheck = false;
    $nameLabel.append($nameText, $name);
    const $dest = el("div", "dlg-dest");
    const $actions = el("div", "dlg-actions");
    const $cancel = button("dlg-btn", "Cancel");
    const $ok = button("dlg-btn dlg-primary", copy ? "Copy here" : "Move here");
    $actions.append($cancel, $ok);
    $foot.append($nameLabel, $dest, $actions);

    $dlg.append($head, $crumbs, $list, $foot);
    $backdrop.appendChild($dlg);

    const finish = (result) => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeydown, true);
      $backdrop.remove();
      if (previousFocus && previousFocus.focus) previousFocus.focus();
      resolve(result);
    };

    const getDest = () => joinPath(curDir, $name.value.trim());

    const isValid = () => {
      const name = $name.value.trim();
      if (!name || name.includes("/") || name === "." || name === "..") return false;
      const dest = getDest();
      if (dest === filePath) return false;
      if (isDir && (dest === filePath || dest.startsWith(filePath + "/"))) return false;
      return true;
    };

    const updateFoot = () => {
      $dest.textContent = `→ ${getDest()}`;
      $ok.textContent = copy ? "Copy here" : curDir === origDir ? "Rename" : "Move here";
      $ok.disabled = !isValid();
    };

    const renderCrumbs = () => {
      $crumbs.replaceChildren();
      const parts = curDir === "/" ? [] : curDir.split("/").slice(1);
      const segments = [{ label: "Root", dir: "/" }];
      let acc = "";
      for (const part of parts) {
        acc += "/" + part;
        segments.push({ label: part, dir: acc });
      }
      segments.forEach((seg, i) => {
        if (i > 0) $crumbs.appendChild(el("span", "dlg-sep", "/"));
        if (i === segments.length - 1) {
          $crumbs.appendChild(el("b", "", seg.label));
        } else {
          const $c = button("dlg-crumb", seg.label);
          $c.addEventListener("click", () => loadDir(seg.dir));
          $crumbs.appendChild($c);
        }
      });
    };

    const renderList = () => {
      $list.replaceChildren();
      if (curDir !== "/") {
        const $up = button("dlg-item dlg-up");
        $up.innerHTML = ICONS.dir;
        $up.appendChild(el("span", "", ".."));
        $up.addEventListener("click", () => loadDir(parentDir(curDir)));
        $list.appendChild($up);
      }
      for (const name of dirs) {
        const self = isDir && joinPath(curDir, name) === filePath;
        const $item = button("dlg-item");
        $item.innerHTML = ICONS.dir;
        $item.appendChild(el("span", "", name));
        if (self) {
          $item.disabled = true;
          $item.title = `Cannot ${copy ? "copy" : "move"} a folder into itself`;
        } else {
          $item.addEventListener("click", () => loadDir(joinPath(curDir, name)));
        }
        $list.appendChild($item);
      }
      if (dirs.length === 0) {
        $list.appendChild(el("div", "dlg-note", "No subfolders"));
      }
    };

    const loadDir = async (dir) => {
      const id = ++loadId;
      curDir = dir;
      dirs = [];
      renderCrumbs();
      updateFoot();
      $list.replaceChildren(el("div", "dlg-note", "Loading…"));
      try {
        const res = await fetch(dirUrl(dir) + "?json");
        await assertResOK(res);
        const data = await res.json();
        if (id !== loadId) return;
        dirs = (data.paths || [])
          .filter(p => p && p.path_type && p.path_type.endsWith("Dir"))
          .map(p => p.name);
        renderList();
      } catch (err) {
        if (id !== loadId) return;
        $list.replaceChildren(el("div", "dlg-note dlg-error", `Cannot load folder: ${err.message}`));
      }
    };

    const confirmMove = () => {
      if (!isValid()) return;
      finish(getDest());
    };

    function onKeydown(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        finish();
      }
    }

    $close.addEventListener("click", () => finish());
    $cancel.addEventListener("click", () => finish());
    $backdrop.addEventListener("mousedown", e => {
      if (e.target === $backdrop) finish();
    });
    $ok.addEventListener("click", confirmMove);
    $name.addEventListener("input", updateFoot);
    $name.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        confirmMove();
      }
    });
    document.addEventListener("keydown", onKeydown, true);

    document.body.appendChild($backdrop);
    // Focus the dialog itself (not the name field) so nothing is highlighted
    // and the mobile keyboard doesn't pop up over the folder list.
    $dlg.tabIndex = -1;
    $dlg.focus({ preventScroll: true });
    loadDir(curDir);
  });
}

/**
 * Save editor change
 */
async function saveChange() {
  try {
    await fetch(baseUrl(), {
      method: "PUT",
      body: $editor.value,
    });
    location.reload();
  } catch (err) {
    alert(`Failed to save file, ${err.message}`);
  }
}

async function checkAuth(variant) {
  if (!DATA.auth) return;
  const qs = variant ? `?${variant}` : "";
  const res = await fetch(baseUrl() + qs, {
    method: "CHECKAUTH",
  });
  await assertResOK(res);
  $loginBtn.classList.add("hidden");
}

/**
 * Create a folder
 * @param {string} name
 */
async function createFolder(name) {
  const url = newUrl(name);
  try {
    await checkAuth();
    const res = await fetch(url, {
      method: "MKCOL",
    });
    await assertResOK(res);
    location.href = url;
  } catch (err) {
    alert(`Cannot create folder \`${name}\`, ${err.message}`);
  }
}

async function createFile(name) {
  const url = newUrl(name);
  try {
    await checkAuth();
    const res = await fetch(url, {
      method: "PUT",
      body: "",
    });
    await assertResOK(res);
    location.href = url + "?edit";
  } catch (err) {
    alert(`Cannot create file \`${name}\`, ${err.message}`);
  }
}

async function addFileEntries(entries, dirs) {
  for (const entry of entries) {
    if (entry.isFile) {
      entry.file(file => {
        new Uploader(file, dirs).upload();
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();

      const successCallback = entries => {
        if (entries.length > 0) {
          addFileEntries(entries, [...dirs, entry.name]);
          dirReader.readEntries(successCallback);
        }
      };

      dirReader.readEntries(successCallback);
    }
  }
}


function newUrl(name) {
  let url = baseUrl();
  if (!url.endsWith("/")) url += "/";
  url += name.split("/").map(encodeURIComponent).join("/");
  return url;
}

function baseUrl() {
  return location.href.split(/[?#]/)[0];
}

function baseName(url) {
  return decodeURIComponent(url.split("/").filter(v => v.length > 0).slice(-1)[0]);
}

function extName(filename) {
  const dotIndex = filename.lastIndexOf('.');

  if (dotIndex === -1 || dotIndex === 0 || dotIndex === filename.length - 1) {
    return '';
  }

  return filename.substring(dotIndex);
}

function getPathSvg(path_type) {
  switch (path_type) {
    case "Dir":
      return ICONS.dir;
    case "SymlinkFile":
      return ICONS.symlinkFile;
    case "SymlinkDir":
      return ICONS.symlinkDir;
    default:
      return ICONS.file;
  }
}

function formatMtime(mtime) {
  if (!mtime) return "";
  const date = new Date(mtime);
  const year = date.getFullYear();
  const month = padZero(date.getMonth() + 1, 2);
  const day = padZero(date.getDate(), 2);
  const hours = padZero(date.getHours(), 2);
  const minutes = padZero(date.getMinutes(), 2);
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function padZero(value, size) {
  return ("0".repeat(size) + value).slice(-1 * size);
}

function formatDirSize(size) {
  const unit = size === 1 ? "item" : "items";
  const num = size >= MAX_SUBPATHS_COUNT ? `>${MAX_SUBPATHS_COUNT - 1}` : `${size}`;
  return ` ${num} ${unit}`;
}

function formatFileSize(size) {
  if (size == null) return [0, "B"];
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (size === 0) return [0, "B"];
  const i = parseInt(Math.floor(Math.log(size) / Math.log(1024)));
  const raw = size / Math.pow(1024, i);
  let value;
  if (i > 0 && raw < 999.95) {
    value = Math.round(raw * 10) / 10;
  } else {
    value = Math.round(raw);
  }
  return [value, sizes[i]];
}

function formatDuration(seconds) {
  seconds = Math.ceil(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds - h * 3600) / 60);
  const s = seconds - h * 3600 - m * 60;
  return `${padZero(h, 2)}:${padZero(m, 2)}:${padZero(s, 2)}`;
}

function formatPercent(percent) {
  if (percent > 10) {
    return percent.toFixed(1) + "%";
  } else {
    return percent.toFixed(2) + "%";
  }
}

function encodedStr(rawStr) {
  return rawStr.replace(/[\u00A0-\u9999<>\&]/g, function (i) {
    return '&#' + i.charCodeAt(0) + ';';
  });
}

async function assertResOK(res) {
  if (!(res.status >= 200 && res.status < 300)) {
    throw new Error(await res.text() || `Invalid status ${res.status}`);
  }
}

function getEncoding(contentType) {
  const charset = contentType?.split(";")[1];
  if (/charset/i.test(charset)) {
    let encoding = charset.split("=")[1];
    if (encoding) {
      return encoding.toLowerCase();
    }
  }
  return 'utf-8';
}

function decodeBase64(base64String) {
  const binString = atob(base64String);
  const len = binString.length;
  const bytes = new Uint8Array(len);
  const arr = new Uint32Array(bytes.buffer, 0, Math.floor(len / 4));
  let i = 0;
  for (; i < arr.length; i++) {
    arr[i] = binString.charCodeAt(i * 4) |
      (binString.charCodeAt(i * 4 + 1) << 8) |
      (binString.charCodeAt(i * 4 + 2) << 16) |
      (binString.charCodeAt(i * 4 + 3) << 24);
  }
  for (i = i * 4; i < len; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}
