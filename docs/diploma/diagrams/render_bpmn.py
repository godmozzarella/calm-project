"""Shared vector renderer; coordinates follow BPMN Diagram Interchange."""
import html
import math
import xml.etree.ElementTree as E

def render(nodes, flows, outbase, TITLE, SUBTITLE, NOTES, W=2400, H=1860):
    mx=E.Element('mxfile',{'host':'app.diagrams.net','type':'device'})
    page=E.SubElement(mx,'diagram',{'id':'calm-overview','name':'Calm — обзор BPMN'})
    model=E.SubElement(page,'mxGraphModel',dict(grid='1',gridSize='10',page='1',pageScale='1',pageWidth=str(W),pageHeight=str(H),background='#ffffff'))
    root=E.SubElement(model,'root'); E.SubElement(root,'mxCell',id='0'); E.SubElement(root,'mxCell',id='1',parent='0')
    svg=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">', '<rect width="100%" height="100%" fill="white"/>', '<defs><marker id="arrow" markerWidth="10" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 0 L9 4 L0 8 Z" fill="#334155"/></marker><marker id="open" markerWidth="12" markerHeight="10" refX="11" refY="5" orient="auto"><path d="M1 1 L11 5 L1 9" fill="none" stroke="#64748b" stroke-width="1.5"/></marker></defs>']

    def cell(id,x,y,w,h,value='',style=''):
        c=E.SubElement(root,'mxCell',dict(id=id,value=value,vertex='1',parent='1',style=style+'fontFamily=Arial;fontColor=#172b4d;'))
        E.SubElement(c,'mxGeometry',dict(x=str(x),y=str(y),width=str(w),height=str(h),**{'as':'geometry'}))

    def text(id,txt,x,y,w,h,size=19,bold=False,rotate=False,bg=False):
        mxbox=(x+(w-h)/2,y+(h-w)/2,h,w) if rotate else (x,y,w,h)
        cell(id,*mxbox,txt,'text;html=0;whiteSpace=wrap;align=center;verticalAlign=middle;strokeColor=none;fillColor='+('#ffffff' if bg else 'none')+f';fontSize={size};fontStyle={1 if bold else 0};'+('rotation=270;' if rotate else ''))
        if bg: svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="white"/>')
        lines=txt.split('\n'); cx=x+w/2; cy=y+h/2
        transform=f' transform="rotate(-90 {cx} {cy})"' if rotate else ''
        svg.append(f'<text text-anchor="middle" font-family="Arial, sans-serif" font-size="{size}" font-weight="{600 if bold else 400}" fill="#172b4d"{transform}>')
        for i,line in enumerate(lines):
            yy=cy+(i-(len(lines)-1)/2)*size*1.22+size*.34
            svg.append(f'<tspan x="{cx}" y="{yy}">{html.escape(line)}</tspan>')
        svg.append('</text>')

    def rect(id,x,y,w,h,fill='#ffffff',radius=0,stroke='#334155',sw=1.5):
        cell(id,x,y,w,h,style=f'rounded={int(radius>0)};arcSize=12;whiteSpace=wrap;html=0;fillColor={fill};strokeColor={stroke};strokeWidth={sw};')
        svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

    def line(id,points,dash=False,color='#334155',sw=1.5):
        c=E.SubElement(root,'mxCell',dict(id=id,edge='1',parent='1',style=f'endArrow=none;strokeColor={color};strokeWidth={sw};dashed={int(dash)};'))
        geo=E.SubElement(c,'mxGeometry',{'relative':'1','as':'geometry'})
        for key,p in [('sourcePoint',points[0]),('targetPoint',points[-1])]: E.SubElement(geo,'mxPoint',dict(x=str(p[0]),y=str(p[1]),**{'as':key}))
        arr=E.SubElement(geo,'Array',{'as':'points'})
        for x,y in points[1:-1]: E.SubElement(arr,'mxPoint',dict(x=str(x),y=str(y)))
        svg.append(f'<polyline points="'+ ' '.join(f'{x},{y}' for x,y in points)+f'" fill="none" stroke="{color}" stroke-width="{sw}"'+(' stroke-dasharray="6 5"' if dash else '')+'/>')

    for n in nodes.values():
        if n['kind'] not in ('pool','lane','external'): continue
        x,y,w,h=(n[k] for k in ('x','y','w','h'))
        fill='#ffffff' if n['kind']=='pool' else '#f8fafc'
        rect(n['id'],x,y,w,h,fill=fill)
        if n['kind']=='external':
            line(n['id']+'_divider',[(x+35,y),(x+35,y+h)])
            text(n['id']+'_label',n['name'],x+45,y+5,w-55,h-10,20,True)
        else:
            text(n['id']+'_label',n['name'],x+4,y,32,h,18,True,True)
            line(n['id']+'_divider',[(x+40,y),(x+40,y+h)])

    for f in flows:
        s,t=nodes[f['source']],nodes[f['target']]; pts=f['points']
        ex=(pts[0][0]-s['x'])/s['w']; ey=(pts[0][1]-s['y'])/s['h']
        tx=(pts[-1][0]-t['x'])/t['w']; ty=(pts[-1][1]-t['y'])/t['h']
        kind=f['kind']; color='#64748b' if kind!='sequence' else '#334155'
        style=f'edgeStyle=none;rounded=0;html=0;strokeColor={color};strokeWidth=1.5;exitX={ex};exitY={ey};entryX={tx};entryY={ty};exitPerimeter=0;entryPerimeter=0;'
        style+='endArrow=block;endFill=1;' if kind=='sequence' else 'dashed=1;endArrow='+('open;startArrow=oval;startFill=0;' if kind=='message' else 'none;')
        c=E.SubElement(root,'mxCell',dict(id=f['id'],edge='1',parent='1',source=f['source'],target=f['target'],style=style))
        geo=E.SubElement(c,'mxGeometry',{'relative':'1','as':'geometry'}); arr=E.SubElement(geo,'Array',{'as':'points'})
        for x,y in pts[1:-1]: E.SubElement(arr,'mxPoint',dict(x=str(x),y=str(y)))
        marker='url(#arrow)' if kind=='sequence' else 'url(#open)' if kind=='message' else 'none'
        svg.append('<polyline points="'+' '.join(f'{x},{y}' for x,y in pts)+f'" fill="none" stroke="{color}" stroke-width="1.5" marker-end="{marker}"'+(' stroke-dasharray="7 5"' if kind!='sequence' else '')+'/>')
        if kind=='message': svg.append(f'<circle cx="{pts[0][0]}" cy="{pts[0][1]}" r="4" fill="white" stroke="{color}"/>')

    for f in flows:
        if f.get('default'):
            a,b=f['points'][:2]
            dx,dy=b[0]-a[0],b[1]-a[1]
            length=math.hypot(dx,dy)
            if length:
                ux,uy=dx/length,dy/length
                cx,cy=a[0]+12*ux,a[1]+12*uy
                line(f['id']+'_default',[(cx-5*ux-6*uy,cy-5*uy+6*ux),(cx+5*ux+6*uy,cy+5*uy-6*ux)],sw=2)

    for n in nodes.values():
        kind=n['kind']; x,y,w,h=(n[k] for k in ('x','y','w','h')); id=n['id']
        if kind in ('pool','lane','external'): continue
        if kind in ('sub','task','service','user','send'):
            rect(id,x,y,w,h,fill=n.get('fill','#eef5fa' if kind=='sub' else '#ffffff'),radius=10)
            text(id+'_label',n['name'],x+22,y+5,w-44,h-(24 if kind=='sub' else 10),18)
            if kind=='sub':
                rect(id+'_plus',x+w/2-7,y+h-17,14,14)
                line(id+'_plus_h',[(x+w/2-4,y+h-10),(x+w/2+4,y+h-10)])
                line(id+'_plus_v',[(x+w/2,y+h-14),(x+w/2,y+h-6)])
            if kind=='user':
                cell(id+'_head',x+10,y+6,8,8,style='ellipse;fillColor=none;strokeColor=#334155;')
                svg.append(f'<circle cx="{x+14}" cy="{y+10}" r="4" fill="none" stroke="#334155"/>')
                line(id+'_person',[(x+7,y+25),(x+7,y+19),(x+10,y+16),(x+18,y+16),(x+21,y+19),(x+21,y+25),(x+7,y+25)])
            elif kind in ('service','send'):
                text(id+'_type',{'service':'⚙','send':'✉'}[kind],x+3,y+2,22,24,18)
        elif kind=='xor':
            cell(id,x,y,w,h,style='rhombus;fillColor=#ffffff;strokeColor=#334155;strokeWidth=1.5;')
            svg.append(f'<polygon points="{x+w/2},{y} {x+w},{y+h/2} {x+w/2},{y+h} {x},{y+h/2}" fill="white" stroke="#334155" stroke-width="1.5"/>')
            text(id+'_x','×',x,y,w,h,26)
        elif kind in ('start','end','timer','conditional'):
            sw=3.5 if kind=='end' else 1.7
            cell(id,x,y,w,h,style=f'ellipse;fillColor=#ffffff;strokeColor=#334155;strokeWidth={sw};')
            svg.append(f'<ellipse cx="{x+w/2}" cy="{y+h/2}" rx="{w/2}" ry="{h/2}" fill="white" stroke="#334155" stroke-width="{sw}"/>')
            if kind=='timer':
                cx,cy=x+w/2,y+h/2
                cell(id+'_clock',x+7,y+7,w-14,h-14,style='ellipse;fillColor=none;strokeColor=#334155;')
                svg.append(f'<circle cx="{cx}" cy="{cy}" r="11" fill="none" stroke="#334155"/>')
                for i in range(12):
                    a=i*math.pi/6
                    line(id+'_tick'+str(i),[(cx+9*math.sin(a),cy-9*math.cos(a)),(cx+11*math.sin(a),cy-11*math.cos(a))],sw=.8)
                line(id+'_hands',[(cx,cy-7),(cx,cy),(cx+5,cy+3)])
            elif kind=='conditional':
                rect(id+'_condition',x+11,y+8,14,20)
                for j in range(3): line(id+'_rule'+str(j),[(x+14,y+13+j*5),(x+22,y+13+j*5)],sw=1)
        elif kind=='tag':
            cell(id,x,y,w,h,style='fillColor=none;strokeColor=none;')
            line(id+'_bracket',[(x+10,y),(x,y),(x,y+h),(x+10,y+h)],color='#64748b')
            text(id+'_label',n['name'],x+16,y+3,w-20,h-6,20,True)
        elif kind=='note':
            # Invisible anchor cell keeps the association editable.
            cell(id,x,y,w,h,style='fillColor=none;strokeColor=none;')
            line(id+'_bracket',[(x+14,y),(x,y),(x,y+h),(x+14,y+h)])
            text(id+'_label',n['name'],x+20,y+5,w-25,h-10,20)
        if n['label'] and n['name']: text(id+'_label',n['name'],*n['label'],size=17)
    for f in flows:
        if f['name'] and f['label']: text(f['id']+'_label',f['name'],*f['label'],size=17,bg=True)
    text('Title',TITLE,60,12,W-120,40,32,True)
    text('Subtitle',SUBTITLE,60,52,W-120,28,19)
    for i,txt in enumerate(NOTES): text('Legend'+str(i),txt,80,H-157+i*27,W-160,25,18)
    svg.append('</svg>')
    (outbase.with_suffix('.svg')).write_text('\n'.join(svg),encoding='utf-8')
    # Labels and BPMN markers travel with their node when edited in draw.io.
    for c in root.findall('mxCell'):
        owner=next((n for id,n in nodes.items() if c.get('id','').startswith(id+'_')),None)
        if owner is None: continue
        c.set('parent',owner['id'])
        geo=c.find('mxGeometry')
        if c.get('vertex')=='1':
            geo.set('x',str(float(geo.get('x','0'))-owner['x']))
            geo.set('y',str(float(geo.get('y','0'))-owner['y']))
        else:
            for point in geo.iter('mxPoint'):
                point.set('x',str(float(point.get('x','0'))-owner['x']))
                point.set('y',str(float(point.get('y','0'))-owner['y']))
    E.indent(mx); E.ElementTree(mx).write(outbase.with_suffix('.drawio'),encoding='utf-8',xml_declaration=True)
