/* Starlite shared shell interactions */
(() => {
  const root=document.querySelector(".starlite-app");
  if(!root)return;
  const html=document.documentElement;
  const sidebar=root.querySelector("#appSidebar");
  const themeButtons=[...root.querySelectorAll("[data-theme-choice]")];
  const themeKey="starlite-theme";
  const collapseKey="starlite-sidebar-collapsed";
  const savedTheme=localStorage.getItem(themeKey)||"system";
  const applyTheme=(choice)=>{
    const resolved=choice==="system"?(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):choice;
    html.dataset.theme=resolved;
    html.dataset.themePreference=choice;
    themeButtons.forEach(btn=>{btn.classList.toggle("active",btn.dataset.themeChoice===choice);btn.setAttribute("aria-pressed",String(btn.dataset.themeChoice===choice));});
    localStorage.setItem(themeKey,choice);
  };
  applyTheme(savedTheme);
  themeButtons.forEach(btn=>btn.addEventListener("click",()=>applyTheme(btn.dataset.themeChoice)));
  const media=window.matchMedia?window.matchMedia("(prefers-color-scheme: light)"):null;
  if(media)media.addEventListener?.("change",()=>{if((localStorage.getItem(themeKey)||"system")==="system")applyTheme("system");});
  if(localStorage.getItem(collapseKey)==="true")root.classList.add("is-collapsed");
  root.querySelectorAll("[data-sidebar-toggle]").forEach(btn=>btn.addEventListener("click",()=>{
    root.classList.toggle("is-collapsed");localStorage.setItem(collapseKey,String(root.classList.contains("is-collapsed")));
  }));
  const openMobile=()=>sidebar?.classList.add("mobile-open");
  const closeMobile=()=>{sidebar?.classList.remove("mobile-open");root.querySelector(".sidebar-backdrop")?.classList.remove("visible");};
  root.querySelector("[data-mobile-menu]")?.addEventListener("click",()=>{openMobile();root.querySelector(".sidebar-backdrop")?.classList.add("visible");});
  root.querySelector("[data-sidebar-close]")?.addEventListener("click",closeMobile);
  const currentPath=window.location.pathname.replace(/\/+$/,"")||"/";
  root.querySelectorAll(".sidebar-link").forEach(link=>{const target=new URL(link.href,window.location.origin).pathname.replace(/\/+$/,"")||"/";if(target===currentPath){link.classList.add("active");link.setAttribute("aria-current","page");}else{link.classList.remove("active");link.removeAttribute("aria-current");}});
  root.querySelectorAll(".sidebar-link").forEach(link=>link.addEventListener("click",()=>{
    if(link.getAttribute("href")?.startsWith("#")){
      root.querySelectorAll(".sidebar-link").forEach(x=>x.classList.remove("active"));link.classList.add("active");
      const label=link.querySelector("span")?.textContent;if(label&&root.querySelector("#topbarPageTitle"))root.querySelector("#topbarPageTitle").textContent=label;
    const eyebrow=root.querySelector(".page-intro .page-eyebrow");if(eyebrow)eyebrow.textContent="STARLITE / "+label.toUpperCase();
    }
    closeMobile();
  }));
  const page=root.dataset.page;
  if(page==="overview"){
    const inventory=document.querySelector("#network-inventory");
    const operations=document.querySelector("#field-operations");
    if(inventory)inventory.id="network-inventory";
    if(operations)operations.id="field-operations";
  }
})();
