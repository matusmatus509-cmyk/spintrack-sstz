import React, { useEffect, useState } from 'react';
import { CalendarPlus, Check, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import { useApp } from '../context/AppContext';
import '../views/RecommendedTournaments.css';
interface Category { label: string; reason: string; minimumBirthYear: number }
interface Tournament { id: string; title: string; date: string; url: string; registrationUrl: string; propositionUrl: string; categories: Category[] }
interface Result { player: { name: string; birthYear: number; club: string; gender: string | null; licenseUntil: string }; tournaments: Tournament[]; checkedAt: string; checkedCount: number; unavailableCount: number; note: string }
export const RecommendedTournaments: React.FC = () => {
  const { tournamentProfile, activities, addActivity } = useApp();
  const [data,setData]=useState<Result|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);
  const [selection,setSelection]=useState<Record<string,string>>({});
  const [notice,setNotice]=useState('');
  useEffect(()=>{
    setData(null);setError('');setNotice('');setSelection({});setLoading(false);
    if (!tournamentProfile) return;
    const controller=new AbortController();setLoading(true);
    fetch(`/api/sstz/tournaments/recommendations/${encodeURIComponent(tournamentProfile.id)}`,{signal:controller.signal,cache:'no-store'})
      .then(async response=>{const result=await response.json();if(!response.ok) throw new Error(result.error||'Turnaje sa nepodarilo načítať.');if(!Array.isArray(result.tournaments)||!result.player)throw new Error('SSTZ vrátilo neúplné odporúčania.');if(!controller.signal.aborted)setData(result);})
      .catch(err=>{if(!controller.signal.aborted)setError(err instanceof Error?err.message:'Turnaje sa nepodarilo načítať.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[tournamentProfile?.id,refresh]);
  const add = (event:Tournament) => {
    if(activities.some(activity=>activity.sourceEventId===event.id))return;
    const category=event.categories.find(c=>c.label===selection[event.id])||event.categories[0];
    addActivity({category:'turnaj',planned:true,date:event.date,durationMinutes:0,focusDrills:[],title:event.title,eventCategory:category.label,sourceEventId:event.id,location:'',publicNote:'',privateNote:event.url,visibility:'private',addEquipmentWear:false});
    setNotice(`${event.title} je pridaný do kalendára. Prihlásenie dokonči na SSTZ.`);
  };
  return <section className="recommendations-panel" aria-labelledby="recommended-tournaments-title">
    <header className="recommendations-heading"><div className="recommendations-title"><span className="recommendations-icon"><Sparkles size={22}/></span><div><span className="eyebrow">TVOJ ĎALŠÍ TURNAJ</span><h2 id="recommended-tournaments-title">Odporúčané turnaje</h2></div></div>{tournamentProfile&&<button type="button" className="recommendations-refresh" aria-label="Obnoviť odporúčané turnaje" disabled={loading} onClick={()=>setRefresh(v=>v+1)}><RefreshCw size={17} className={loading?'spin':''}/></button>}</header>
    <p className="recommendations-intro">Nadchádzajúce turnaje podľa tvojho SSTZ profilu. Iba kategórie, do ktorých vekovo patríš a pri ktorých vieme overiť podmienky účasti.</p>
    {!tournamentProfile&&<div className="recommendations-empty"><h3>Najprv pripoj svoj SSTZ profil</h3><p>Vyhľadaj sa v časti nižšie a načítaj svoj profil. Ročník a klub zistíme zo SSTZ.</p><a href="#tournament-search-title">Vyhľadať svoj profil ↓</a></div>}
    {loading&&<p role="status" className="recommendations-empty">Overujem profil, kategórie a propozície na SSTZ…</p>}
    {error&&<div role="alert" className="recommendations-empty"><p>{error}</p><button type="button" className="btn-secondary" onClick={()=>setRefresh(v=>v+1)}>Skúsiť znova</button></div>}
    {data&&<><div className="recommendations-profile"><span>{data.player.name}</span><span>Ročník {data.player.birthYear}</span>{data.player.club&&<span>{data.player.club}</span>}</div>
      {!data.tournaments.length&&<div className="recommendations-empty"><h3>Momentálne bez vhodného turnaja</h3><p>{!data.player.gender?'V profile sa nepodarilo overiť súťažné pohlavie.':!data.player.licenseUntil?'V profile chýba platnosť licencie.':'V zverejnených turnajoch nemáme potvrdenú vhodnú otvorenú kategóriu pre tvoj profil.'} Nové termíny môžeš skontrolovať obnovením.</p></div>}
      <div className="recommendations-grid">{data.tournaments.map(event=>{const saved=activities.some(activity=>activity.sourceEventId===event.id);return <article className="recommended-tournament" key={event.id}><div className="recommended-date"><span>{new Date(event.date+'T12:00:00').toLocaleDateString('sk-SK',{day:'numeric',month:'short'})}</span><span>{new Date(event.date+'T12:00:00').toLocaleDateString('sk-SK',{weekday:'long'})}</span></div><div className="recommended-content"><span className="recommended-label"><Check size={13}/>Vhodná kategória</span><h3>{event.title}</h3><label className="recommended-category">Tvoja kategória<select aria-label={`Kategória: ${event.title}`} value={selection[event.id]||event.categories[0].label} disabled={saved} onChange={e=>setSelection(previous=>({...previous,[event.id]:e.target.value}))}>{event.categories.map(category=><option key={category.label}>{category.label}</option>)}</select></label><p>Ročník {event.categories.find(category=>category.label===(selection[event.id]||event.categories[0].label))?.minimumBirthYear} a mladší · overená licencia</p><div className="recommended-actions"><button type="button" disabled={saved} onClick={()=>add(event)}>{saved?<Check size={16}/>:<CalendarPlus size={16}/>} {saved?'V kalendári':'Pridať do kalendára'}</button><a href={event.registrationUrl} target="_blank" rel="noopener noreferrer">Prihlásiť na SSTZ <ExternalLink size={13}/></a><a href={event.propositionUrl} target="_blank" rel="noopener noreferrer">Propozície</a></div></div></article>;})}</div>
      <p className="recommendations-footnote">{data.note}</p><p className="recommendations-footnote">Overené {new Date(data.checkedAt).toLocaleString('sk-SK')} · kontrolovaných {data.checkedCount} nadchádzajúcich turnajov zo SSTZ{data.unavailableCount>0?` · ${data.unavailableCount} turnajov sa nepodarilo overiť`:''}. <a href="https://turnaje.sstz.sk/turnaje" target="_blank" rel="noopener noreferrer">Všetky turnaje na SSTZ ↗</a></p></>}
    {notice&&<p className="recommendations-notice" role="status"><Check size={16}/>{notice}</p>}
  </section>;
};
