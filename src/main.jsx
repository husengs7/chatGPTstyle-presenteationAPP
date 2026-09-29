import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import './style.css';

GlobalWorkerOptions.workerSrc = workerUrl;
const demo = [
  ['完璧なプレゼンを、\nひとことから。', '生成AI時代の「つくる」を、もう一度考える。', 'THE PERFECT PRESENTATION'],
  ['考える時間は、\nどこへ行った？', '10時間の思考。10秒の生成。\nその差を、私たちは何と呼ぶのだろう。', '01 / THE QUESTION'],
  ['見た目は完璧。\n中身は、誰のもの？', 'きれいな図解。もっともらしい数字。\nそして、どこにもいない話し手。', '02 / THE PARADOX'],
  ['最後の1枚は、\nあなたの言葉で。', 'AIがスライドをつくる。\n意味をつくるのは、あなた。', '03 / YOUR TURN'],
];
function Icon({ name, size = 20 }) {
  const paths = { plus: 'M12 5v14M5 12h14', arrow: 'M12 19V5m-6 6 6-6 6 6', file: 'M14 2H5v20h14V7l-5-5Zm0 0v6h5M8 13h8M8 17h6', play: 'm8 5 11 7-11 7V5Z', pause: 'M8 5v14M16 5v14', expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5', chevron: 'm9 5 7 7-7 7', chat: 'M21 11a9 9 0 0 1-9 9H3l2-5a9 9 0 1 1 16-4Z', close: 'm6 6 12 12M6 18 18 6', check: 'm5 12 4 4L19 6' };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.chat}/></svg>;
}
function Mark({ small = false }) { return <span className={`mark ${small ? 'small' : ''}`} aria-hidden="true">✳</span>; }
function Slide({ pdf, number }) {
  const canvas = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!pdf) return;
    let cancelled = false, task;
    (async () => {
      const page = await pdf.getPage(number);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: Math.min(3, 2560 / page.getViewport({ scale: 1 }).width) });
      const element = canvas.current;
      element.width = viewport.width; element.height = viewport.height;
      task = page.render({ canvasContext: element.getContext('2d'), viewport });
      await task.promise;
    })().catch(e => { if (!cancelled) setError('このページを表示できませんでした。別のPDFをお試しください。'); });
    return () => { cancelled = true; task?.cancel(); };
  }, [pdf, number]);
  if (error) return <p role="alert">{error}</p>;
  if (pdf) return <canvas ref={canvas} className="pdf-canvas" aria-label={`スライド ${number}`}/>;
  const [title, subtitle, eyebrow] = demo[number - 1];
  return <div className={`demo-slide demo-${number}`}><span className="slide-eyebrow">SLIDECHAT STUDIO <span>2026</span></span><div><p className="slide-label">{eyebrow}</p><h2>{title}</h2><p className="slide-subtitle">{subtitle}</p></div><footer><span>A LITTLE THOUGHT ABOUT ARTIFICIAL INTELLIGENCE</span><span>0{number}</span></footer><div className="orb"/></div>;
}
function App() {
  const [pdf, setPdf] = useState(null), [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [started, setStarted] = useState(false), [count, setCount] = useState(0);
  const [auto, setAuto] = useState(false), [prompt, setPrompt] = useState('完璧なプレゼンスライドを生成して。');
  const [sentPrompt, setSentPrompt] = useState(''), [sidebar, setSidebar] = useState(false), [dragging, setDragging] = useState(false);
  const input = useRef(null), bottom = useRef(null), loadingTask = useRef(null);
  const total = pdf?.numPages || demo.length;
  useEffect(() => () => { loadingTask.current?.destroy(); }, []);
  useEffect(() => {
    if (!started || !auto || count >= total) return;
    const timer = setTimeout(() => setCount(c => Math.min(c + 1, total)), 1000);
    return () => clearTimeout(timer);
  }, [started, auto, count, total]);
  useEffect(() => {
    if (!started || !bottom.current) return;
    const scrollToLatest = () => bottom.current?.scrollIntoView({ behavior: 'instant', block: 'end' });
    scrollToLatest();
    const observer = new ResizeObserver(scrollToLatest);
    observer.observe(bottom.current.parentElement);
    return () => observer.disconnect();
  }, [count, started]);
  useEffect(() => {
    const handle = e => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable || !started) return;
      if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setAuto(false);
        setCount(c => c > 1 ? c - 1 : c);
        return;
      }
      if (e.code === 'Space' && e.target.tagName === 'BUTTON') return;
      if (e.code === 'ArrowRight' || e.code === 'Space') { e.preventDefault(); setCount(c => Math.min(c + 1, total)); }
    };
    window.addEventListener('keydown', handle); return () => window.removeEventListener('keydown', handle);
  }, [started, total]);
  async function loadFile(file) {
    if (!file || loading || started) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) { setError('PDFファイルを選択してください。'); return; }
    if (file.size > 500 * 1024 * 1024) { setError('500MB以下のPDFを選択してください。'); return; }
    setLoading(true); setError('');
    try {
      await loadingTask.current?.destroy(); setPdf(null); setFileName('');
      const base = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI).href;
      const task = getDocument({ data: await file.arrayBuffer(), cMapUrl: `${base}cmaps/`, cMapPacked: true, standardFontDataUrl: `${base}standard_fonts/`, wasmUrl: `${base}wasm/`, iccUrl: `${base}iccs/`, isEvalSupported: false });
      loadingTask.current = task;
      task.onPassword = () => { setError('パスワードを解除したPDFを選択してください。'); void task.destroy(); };
      const loadedPdf = await task.promise;
      setPdf(loadedPdf); setFileName(file.name);
    } catch (error) { console.error('PDF loading failed:', error); setError(previous => previous || 'PDFを読み込めませんでした。ファイルをご確認ください。'); }
    finally { setLoading(false); if (input.current) input.current.value = ''; }
  }
  function start(e) { e?.preventDefault(); if (loading || !prompt.trim()) return; setSentPrompt(prompt.trim()); setStarted(true); setCount(1); setSidebar(false); }
  function reset() { setStarted(false); setCount(0); setAuto(false); setSidebar(false); setError(''); }
  async function fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { setError('このブラウザでは全画面表示が利用できません。'); } }
  return <div className={`app ${started ? 'presenting' : ''} ${sidebar ? 'sidebar-open' : ''}`}>
    {sidebar && <button className="backdrop" aria-label="メニューを閉じる" onClick={() => setSidebar(false)}/>}
    <aside className="sidebar"><a className="brand" href="./" onClick={e => { e.preventDefault(); reset(); }}><Mark small/>SlideChat<span className="beta">BETA</span></a><button className="new-chat" onClick={reset}><Icon name="plus"/>新しいプレゼン<span>↗</span></button><div className="nav-label">ワークスペース</div><button className="nav-item active" onClick={() => setSidebar(false)}><Icon name="chat"/>プレゼンテーション</button><div className="sidebar-file"><div className="nav-label">プレゼン資料</div>{fileName ? <div className="file-mini"><Icon name="file"/><span>{fileName}<small>{total} スライド · 読み込み済み</small></span></div> : <p>まだ資料がありません。<br/>PDFを追加して始めましょう。</p>}</div><div className="sidebar-bottom"><div className="local"><span/>ローカルで動作</div><p>あなたのPDFは、<br/>あなたのブラウザの中だけに。</p><div className="profile"><span className="avatar">Y</span><div>Your workspace<small>発表の準備は、ここから。</small></div><span>⌘</span></div></div></aside>
    <main onDragOver={e => { e.preventDefault(); if (!started && !loading) setDragging(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false); }} onDrop={e => { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }}>
      <header><div><button className="menu-button icon-button" aria-label="メニュー" onClick={() => setSidebar(!sidebar)}>☰</button><span className="header-title">プレゼンテーション <span className="down">⌄</span></span><span className="mode-tag">{started ? 'LIVE' : 'STUDIO'}</span></div><button className="fullscreen" onClick={fullscreen}><Icon name="expand" size={16}/><span>全画面表示</span></button></header>
      {dragging && <div className="drop-overlay"><Icon name="file" size={48}/>PDFをドロップして追加</div>}
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={e => loadFile(e.target.files[0])}/>
      {!started ? <div className="welcome"><div className="intro"><div className="intro-badge"><span/>YOUR NEXT PRESENTATION</div><Mark/><h1>完璧なプレゼンを、<br/><span>ひとことから。</span></h1><p>あなたのスライドが、AIに生み出されていく。<br/>チャットを舞台にした、新しいプレゼンテーション。</p></div>
        <button className={`upload-card ${pdf ? 'uploaded' : ''}`} disabled={loading} onClick={() => input.current.click()}><span className="upload-icon"><Icon name={pdf ? 'check' : 'file'} size={25}/></span><span><strong>{loading ? 'PDFを読み込んでいます…' : fileName || 'プレゼン資料を追加'}</strong><small>{pdf ? `${total}枚のスライド · クリックして差し替え` : 'PDFをドロップ、またはクリックして選択'}</small></span><span className="file-type">{pdf ? 'READY' : 'PDF'}</span></button><p className="privacy">⌁ ファイルは外部に送信されません <span>·</span> 最大500MB</p>
        <form className="composer" onSubmit={start}><label htmlFor="prompt">最初のひとこと</label><textarea id="prompt" value={prompt} maxLength={1000} onChange={e => setPrompt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); start(); } }}/><div className="composer-bottom"><button type="button" className="attach icon-button" aria-label="PDFを添付" disabled={loading} onClick={() => input.current.click()}><Icon name="plus"/></button><span>{pdf ? `${total}枚のスライドを準備しました` : 'PDFがなくても、デモで体験できます'}</span><button className="send" type="submit" aria-label="プレゼンテーションを開始" disabled={loading || !prompt.trim()}><Icon name="arrow"/></button></div></form>
        <div className="suggestions"><span>まずは試してみる</span><button onClick={start}>✧ {pdf ? 'この資料で開始' : 'デモを再生'} <span>↗</span></button></div><div className="steps"><span><b>01</b> PDFを追加</span><i/><span><b>02</b> ひとこと送信</span><i/><span><b>03</b> プレゼン開始</span></div>
      </div> : <><div className="conversation"><div className="user-message">{sentPrompt}</div><div className="assistant-heading"><Mark small/><strong>SlideChat</strong><span>今</span></div><p className="assistant-intro">もちろんです。完璧なプレゼンテーションを作成します。</p>{Array.from({ length: count }, (_, index) => <section className="slide-message" key={index}><div className="user-message slide-request">{index + 1}枚目のスライドを生成して。</div><div className="slide-meta"><span><span className="green-dot"/>スライド {String(index + 1).padStart(2, '0')}</span><span>SlideChat</span></div><div className="slide-frame"><Slide pdf={pdf} number={index + 1}/></div><div className="slide-caption">{index === total - 1 ? 'プレゼンテーションが完成しました。' : 'スライドを作成しました。'}</div></section>)}<div className="generation-status"><div className="thinking" role="status"><span className="thinking-dot"/>構成を考えています<span className="ellipsis">…</span></div></div><div ref={bottom}/></div><div className="playback"><div className="playback-top"><span className="chat-status"><Mark small/>{count === total ? '完成しました' : '次の指示を待っています'}</span><div className="playback-actions"><button className={`auto-button ${auto ? 'enabled' : ''}`} disabled={count === total} onClick={() => setAuto(!auto)}><Icon name={auto ? 'pause' : 'play'} size={15}/>{auto ? '自動送り停止' : '自動送り'}</button><button className="next-button" disabled={count === total} onClick={() => setCount(c => Math.min(c + 1, total))}>{count === total ? '生成完了' : '次のスライド'}<Icon name={count === total ? 'check' : 'chevron'} size={16}/></button></div></div><div className="progress-track"><div style={{ width: `${count / total * 100}%` }}/></div><p>{count === total ? <button className="replay" onClick={reset}>最初からやり直す ↗</button> : '← 前のスライド / Space・→ 次のスライド'}</p></div></>}
      {error && <div className="error" role="alert">{error}<button aria-label="エラーを閉じる" onClick={() => setError('')}><Icon name="close" size={16}/></button></div>}<footer className="app-footer">{started ? 'SlideChat' : 'これは「生成」を演じるプレゼンテーションツールです。実際のAI生成は行いません。'}<span>A little irony. A great presentation.</span></footer>
    </main>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
