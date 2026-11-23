# SHREE TRADERS – Accounting, GST Billing, Inventory & Khata

A complete business accounting web app (Tally / BUSY / Khata Book style) for an Indian trading business.
It is a single static page: no server, no build step, no installation.

## Put it online free with GitHub Pages
1. Create a free account at https://github.com and click **New repository**. Name it, for example, `shree-traders`, and choose **Public** (GitHub Pages is free for public repositories). Your business data is not in the code; it stays in your own browser.
2. Click **Add file → Upload files**, drag in **index.html** (and, if you like, the `source` and `tests` folders and this README), then **Commit changes**.
3. Open the repository **Settings → Pages**. Under *Build and deployment*, set Source = **Deploy from a branch**, Branch = **main**, folder = **/(root)**, and **Save**.
4. After a minute your link appears there: `https://YOUR-USERNAME.github.io/shree-traders/`

Other free hosts work the same way: drag the folder onto https://app.netlify.com/drop or use Cloudflare Pages or Vercel.

## A custom domain (optional, paid)
Buy a name (for example shreetraders.in) from any registrar, then in GitHub **Settings → Pages → Custom domain** enter it and add the DNS records GitHub shows. HTTPS is turned on automatically.

## Important: where your data is stored
Books are saved in the browser you use, on that device and that web address. A new address (or another phone or computer) starts empty.
* Settings → Backup & data → **Download backup** every working day.
* To move to a new address or device: open the app there, then **Restore backup**.
* Several people on different devices cannot share one set of books with this version.

## Files
* `index.html`  – the whole app (HTML + CSS + JavaScript together). This is the only file you need to publish.
* `source/head.html`   – styles (CSS) and page head
* `source/engine.js`   – accounting engine: double entry, GST, stock, reports
* `source/seed.js`     – optional sample data
* `source/ui1.js`, `ui2.js`, `ui3.js` – screens and actions
* `tests/engine-test.js` – automated checks of the accounting engine (`node tests/engine-test.js`)

Export to PDF / Excel loads small libraries from cdnjs.cloudflare.com, so exports need an internet connection.
