#!/usr/bin/env python3
"""Engrave the confirmed Try Me percussion timeline as PDF and MusicXML.

Uses an isolated Verovio/svglib installation; never writes annotation artifacts.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[2]
KINDS = {
    'kick': ('trk_score_kick_v2', 'F', 4, 'normal', 37),
    'snare': ('trk_score_snare_v2', 'C', 5, 'normal', 39),
    'clap': ('trk_score_clap_v2', 'E', 5, 'diamond', 40),
    'hat': ('trk_score_hat_v2', 'G', 5, 'x', 43),
    'crash': (None, 'A', 5, 'x', 50),
}


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node.get('children', []))


def sub(parent, name, value=None, **attrs):
    node = ET.SubElement(parent, name, {k:str(v) for k,v in attrs.items()})
    if value is not None:
        node.text = str(value)
    return node


def xml_score(measures, cells, last_measure, standalone=False):
    root = ET.Element('score-partwise', version='4.0')
    work = sub(root, 'work')
    sub(work, 'work-title', 'Try Me - Complete Percussion')
    ident = sub(root, 'identification')
    sub(ident, 'creator', 'Kero Kero Bonito', type='composer')
    sub(ident, 'creator', 'Rhythm transcription from the user-confirmed timeline', type='arranger')
    parts = sub(root, 'part-list')
    partdef = sub(parts, 'score-part', id='P1')
    sub(partdef, 'part-name', 'drm.')
    sub(partdef, 'part-abbreviation', 'drm.')
    for kind, (_, _, _, _, midi) in KINDS.items():
        inst = sub(partdef, 'score-instrument', id='I_'+kind)
        sub(inst, 'instrument-name', kind.title())
        mi = sub(partdef, 'midi-instrument', id='I_'+kind)
        sub(mi, 'midi-channel', 10)
        sub(mi, 'midi-unpitched', midi)
    part = sub(root, 'part', id='P1')
    for mi, number in enumerate(measures):
        length = 4 if number==1 else 16
        base = -4 if number==1 else (number-2)*16
        m = sub(part, 'measure', number=number)
        if not standalone and mi and mi%4==0:
            p = sub(m, 'print', **{'new-system':'yes'})
            sub(p, 'measure-numbering', 'measure')
        if mi==0 or number==2:
            attributes = sub(m, 'attributes')
            sub(attributes, 'divisions', 4)
            meter = sub(attributes, 'time', **({'print-object':'no'} if standalone and number>2 else {}))
            sub(meter, 'beats', 1 if number==1 else 4)
            sub(meter, 'beat-type', 4)
            if mi==0:
                clef = sub(attributes, 'clef')
                sub(clef, 'sign', 'percussion')
        if number==1 and not standalone:
            direction = sub(m, 'direction', placement='above')
            typ = sub(direction, 'direction-type')
            met = sub(typ, 'metronome', parentheses='no')
            sub(met, 'beat-unit', 'quarter')
            sub(met, 'per-minute', 107)
            sub(direction, 'sound', tempo=107)
        for pos in range(length):
            if any(e.get('let_ring') for e in cells.get(base+pos, [])):
                d = sub(m, 'direction', placement='above')
                sub(sub(d, 'direction-type'), 'words', 'l.v.', **{'font-style':'italic'})
                sub(d, 'offset', pos)
        if not any(cells.get(base+j) for j in range(length)):
            note=sub(m,'note');sub(note,'rest',measure='yes')
            sub(note,'duration',length);sub(note,'voice',1)
            if number==last_measure:
                bar=sub(m,'barline',location='right');sub(bar,'bar-style','light-heavy')
            continue
        tokens=[]
        pos=0
        while pos<length:
            voices = cells.get(base+pos, [])
            next_hit = next((j for j in range(pos+1,length) if cells.get(base+j)), length)
            span = min(next_hit-pos, 4-pos%4)
            # Percussion values describe rhythmic spacing, not sample duration.
            duration = max(v for v in (1,2,3,4) if v<=span)
            tokens.append({'pos':pos,'duration':duration,'events':voices})
            pos+=duration
        # Beam short notes within quarter-note beats. Rests break beams.
        beams={}
        for beat in range(math.ceil(length/4)):
            group=[]
            def finish():
                if len(group)>=2:
                    for j,token in enumerate(group):
                        beams[token['pos']] = [(1,'begin' if j==0 else 'end' if j==len(group)-1 else 'continue')]
                    sixteenth=[j for j,t in enumerate(group) if t['duration']==1]
                    for j in sixteenth:
                        left=j>0 and group[j-1]['duration']==1
                        right=j<len(group)-1 and group[j+1]['duration']==1
                        val='continue' if left and right else 'begin' if right else 'end' if left else 'forward hook' if j==0 else 'backward hook'
                        beams[group[j]['pos']].append((2,val))
                group.clear()
            for token in [t for t in tokens if t['pos']//4==beat]:
                if token['events'] and token['duration']<4:
                    group.append(token)
                else:
                    finish()
            finish()
        for token in tokens:
            duration=token['duration']
            typ={1:'16th',2:'eighth',3:'eighth',4:'quarter'}[duration]
            events=sorted(token['events'],key=lambda e:list(KINDS).index(e['kind']))
            for ci,e in enumerate(events or [None]):
                note=sub(m,'note', **({'id':e['id']} if e else {}))
                if ci:
                    sub(note,'chord')
                if e:
                    _,step,octave,head,_=KINDS[e['kind']]
                    un=sub(note,'unpitched');sub(un,'display-step',step);sub(un,'display-octave',octave)
                else:
                    sub(note,'rest')
                sub(note,'duration',duration)
                if e:
                    sub(note,'instrument',id='I_'+e['kind'])
                sub(note,'voice',1)
                sub(note,'type',typ)
                if duration==3:
                    sub(note,'dot')
                if e:
                    sub(note,'stem','down')
                    if head!='normal':
                        sub(note,'notehead',head,filled='yes')
                    if ci==0:
                        for level,value in beams.get(token['pos'],[]):
                            sub(note,'beam',value,number=str(level))
        if number==last_measure:
            bar=sub(m,'barline',location='right');sub(bar,'bar-style','light-heavy')
    ET.indent(root)
    return '<?xml version="1.0" encoding="utf-8"?>\n'+ET.tostring(root,encoding='unicode')+'\n'


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot',required=True)
    parser.add_argument('--output',default='out/percussion-score-20261119')
    parser.add_argument('--tooling',default='out/score-tooling')
    args=parser.parse_args()
    sys.path.insert(0,str((ROOT/args.tooling).resolve()))
    import verovio
    from svglib.svglib import svg2rlg
    from reportlab.pdfgen.canvas import Canvas
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    from reportlab.graphics import renderPDF
    import pypdfium2 as pdfium
    from PIL import Image, ImageOps
    from pypdf import PdfReader

    output=(ROOT/args.output).resolve()
    if not output.is_relative_to(ROOT/'out'):
        parser.error('Output must be within out/')
    output.mkdir(parents=True,exist_ok=True)
    temp=output/'render';temp.mkdir(exist_ok=True)
    snapshot=json.loads((ROOT/args.snapshot).read_text(encoding='utf8'))
    timeline=ROOT/'annotations/try-me.timeline.json'
    assert hashlib.sha256(timeline.read_bytes()).hexdigest()==snapshot['revision'],'Stale snapshot'
    project=snapshot['project']
    nodes={n['id']:n for n in walk(project['nodes'])}
    group=nodes['grp_score_drums_v2']
    assert any(c['role']=='human' and '我认可了你全部的' in c['text'] for c in group.get('comments',[]))
    run=json.loads((ROOT/'local/analysis/score-drums-v2-20261119-final/analysis.json').read_text(encoding='utf8'))
    step=run['parameters']['step'];origin=run['parameters']['origin']
    events=[]
    for kind,(track,*_) in KINDS.items():
        if track:
            for e in nodes[track]['items']:
                events.append({'kind':kind,'id':e['id'],'original_sec':e['startSec']})
    for e in nodes['trk_timbre_candidates_v1']['items']:
        if e['id'] in ('TC_029','TC_019'):
            assert any(c['role']=='human' and '镲片' in c['text'] for c in e.get('comments',[]))
            events.append({'kind':'crash','id':e['id'],'original_sec':e['startSec'],'let_ring':e['id']=='TC_019'})
    cells=collections.defaultdict(list)
    for e in events:
        grid=round((e['original_sec']-origin)/step)
        assert abs(e['original_sec']-(origin+grid*step))<.04
        e['grid']=grid;e['quantization_ms']=round((origin+grid*step-e['original_sec'])*1000,4)
        cells[grid].append(e)
    assert len(events)==952
    last_measure=max(e['grid'] for e in events)//16+2
    all_measures=list(range(1,last_measure+1))
    full_xml=xml_score(all_measures,cells,last_measure)
    xml_path=output/'Try-Me-Complete-Percussion.musicxml'
    xml_path.write_text(full_xml,encoding='utf8')
    # Independently parse the score: each source event appears once, at its grid.
    parsed=ET.fromstring(full_xml)
    exported={}
    for m in parsed.findall('./part/measure'):
        number=int(m.attrib['number']);pos=0;last_pos=0
        for n in m.findall('note'):
            chord=n.find('chord') is not None
            onset=last_pos if chord else pos
            if n.find('rest') is None:
                exported[n.attrib['id']]=(-4 if number==1 else (number-2)*16)+onset
            if not chord:
                last_pos=pos;pos+=int(n.findtext('duration'))
        assert pos==(4 if number==1 else 16)
    assert exported=={e['id']:e['grid'] for e in events}
    # Convert one engraved system at a time, giving every page equal readable rows.
    systems=[all_measures[i:i+4] for i in range(0,len(all_measures),4)]
    drawings=[]
    engraved_ids=set()
    vrv=verovio.toolkit()
    options={'inputFrom':'musicxml','breaks':'none','adjustPageHeight':True,'adjustPageWidth':False,
             'pageWidth':2200,'pageHeight':2970,'pageMarginTop':25,'pageMarginBottom':20,
             'pageMarginLeft':10,'pageMarginRight':10,'header':'none','footer':'none',
             'scale':40,'font':'Bravura','mnumInterval':1,'minLastJustification':0}
    vrv.setOptions(options)
    for index,measures in enumerate(systems):
        xml=xml_score(measures,cells,last_measure,standalone=True)
        assert vrv.loadData(xml),f'Engraving failed, system {index+1}'
        assert vrv.getPageCount()==1
        svg=vrv.renderToSVG(1)
        svg_root=ET.fromstring(svg)
        engraved_ids.update(n.attrib['id'] for n in svg_root.iter()
                            if n.attrib.get('id') in exported)
        (temp/f'system-{index+1:02d}.svg').write_text(svg,encoding='utf8')
        drawing=svg2rlg(io.BytesIO(svg.encode()))
        assert drawing is not None
        x0,y0,x1,y1=drawing.getBounds()
        drawing.translate(3-x0,3-y0)
        drawing.width=x1-x0+6
        drawing.height=y1-y0+6
        drawings.append(drawing)
    assert engraved_ids==set(exported),'Engraver dropped source notes'
    pdfmetrics.registerFont(TTFont('Chinese','C:/Windows/Fonts/simsun.ttc',subfontIndex=0))
    pdfmetrics.registerFont(TTFont('Arial',str(Path('C:/Windows/Fonts/arial.ttf'))))
    pdfmetrics.registerFont(TTFont('ArialBold',str(Path('C:/Windows/Fonts/arialbd.ttf'))))
    pdf_path=output/'Try-Me-Complete-Percussion.pdf'
    width,height=A4
    c=Canvas(str(pdf_path),pagesize=A4,pageCompression=1)
    c.setTitle('Try Me | Complete Percussion Score')
    c.setAuthor('Rhythm transcription from user-confirmed annotations')
    pages=math.ceil(len(systems)/8)
    notation_scale=min((width-68)/max(d.width for d in drawings),66/max(d.height for d in drawings))
    def zh(text,x,y,size=8):
        c.setFont('Chinese',size);c.drawString(x,y,text)
    def en(text,x,y,size=8,bold=False):
        c.setFont('ArialBold' if bold else 'Arial',size);c.drawString(x,y,text)
    def tempo(x,y):
        c.saveState();c.translate(x,y);c.rotate(-20)
        c.ellipse(-3.3,-2.2,3.3,2.2,stroke=0,fill=1);c.restoreState()
        c.setLineWidth(.8);c.line(x+2.8,y+.8,x+2.8,y+15)
        en('= 107',x+10,y-3,11,True)
    def clock(sec):
        sec=max(0,sec)
        return f'{int(sec)//60}:{sec%60:06.3f}'
    for page in range(pages):
        left=34;right=width-34
        if page==0:
            en('TRY ME',left,height-49,27,True)
            en('KERO KERO BONITO',left,height-66,9)
            zh('全曲打击乐谱',width-150,height-49,15)
            zh('从你画下的几小节，到整首歌。谢谢你帮忙把节奏听清楚。',left,height-88,9)
            zh('记谱：底鼓＝下方实心音头；军鼓＝中间实心音头；鼓掌＝菱形音头。',left,height-108,8)
            zh('踩镲＝上方 ×；吊镲＝更高处 ×。同一符干上的音头同时击打；l.v.＝让余音自然延长。',left,height-121,8)
            top=height-146;rowheight=78
            tempo(left+23,top+1)
        else:
            en('TRY ME',left,height-36,14,True)
            zh('全曲打击乐谱',left+76,height-36,10)
            en('Kero Kero Bonito',right-83,height-36,8)
            c.setLineWidth(.35);c.line(left,height-46,right,height-46)
            top=height-68;rowheight=87
        for row in range(8):
            si=page*8+row
            if si>=len(drawings):break
            measures=systems[si];drawing=drawings[si]
            label_y=top-row*rowheight
            start=0 if measures[0]==1 else origin+(measures[0]-2)*16*step
            en(clock(start),right-48,label_y,8)
            # Fixed engraving size preserves readability in short/quiet systems.
            scale=notation_scale
            assert drawing.height*scale<=rowheight-11,(si,drawing.height*scale,rowheight)
            drawing.scale(scale,scale)
            renderPDF.draw(drawing,c,left,label_y-10-drawing.height*scale)
        c.setLineWidth(.3);c.line(left,42,right,42)
        zh('全曲展开记谱 · 每行右上角为录音时间 · 鼓声余音自然衰减',left,29,7)
        en(f'{page+1} / {pages}',right-25,29,8)
        if page==pages-1:
            zh('最后一击后让尾音自然衰减至录音结束（3:29.720）。',left,55,7)
        c.showPage()
    c.save()
    reader=PdfReader(str(pdf_path));assert len(reader.pages)==pages
    assert all(float(p.mediabox.width)>590 and float(p.mediabox.height)>840 for p in reader.pages)
    doc=pdfium.PdfDocument(str(pdf_path))
    thumbs=[]
    for i in range(len(doc)):
        img=doc[i].render(scale=1.6).to_pil().convert('RGB')
        img.save(temp/f'page-{i+1:02d}.png')
        img.save(output/f'Try-Me-Percussion-{i+1:02d}.png')
        img.thumbnail((390,552))
        thumbs.append(ImageOps.expand(img,border=8,fill='#ddd'))
    contact=Image.new('RGB',(sum(i.width for i in thumbs),max(i.height for i in thumbs)),'#ddd')
    x=0
    for img in thumbs:contact.paste(img,(x,0));x+=img.width
    contact.save(temp/'contact.png')
    manifest={'timeline_revision':snapshot['revision'],'audio_sha256':run['audio_sha256'],
              'tempo_quarter_bpm':107,'grid_step_sec':step,'first_full_bar_sec':origin,
              'measure_numbering':'1 = 1/4 pickup; 2 onwards = 4/4',
              'measures':last_measure,'systems':len(systems),'pages':pages,
              'counts':dict(collections.Counter(e['kind'] for e in events)),
              'total_onsets':len(events),'overlap_track_counted_again':False,
              'max_quantization_ms':max(abs(e['quantization_ms']) for e in events),
              'musicxml_roundtrip_source_event_grids_match':True,
              'engraved_source_ids_match':True,
              'verovio_version':vrv.getVersion(),'events':events}
    (output/'score-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    assert hashlib.sha256(timeline.read_bytes()).hexdigest()==snapshot['revision']
    print(json.dumps({k:v for k,v in manifest.items() if k!='events'},ensure_ascii=False,indent=2))
    print(pdf_path)


if __name__=='__main__':
    main()
