# Makes the ePub-feature check books: tests/feature/epubcheck3.epub (EPUB 3, nav) and epubcheck2.epub (EPUB 2, NCX).
import zipfile, base64, io, os
from PIL import Image
here=os.path.dirname(os.path.abspath(__file__))
def img(fmt,color):
    b=io.BytesIO(); Image.new('RGB',(64,32),color).save(b,fmt); return b.getvalue()
PNG=img('PNG','red'); JPG=img('JPEG','blue'); COVER=img('JPEG','green')
SVG=b'<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><rect width="64" height="32" fill="purple"/></svg>'
NS='xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"'
def page(title,body,lang=''):
    return f'<?xml version="1.0" encoding="utf-8"?><html {NS}{lang}><head><title>{title}</title></head><body>{body}</body></html>'
CSS='''@font-face{font-family:"BookFace";src:url(../Fonts/BookFace.ttf)}
body{font-family:"BookFace",serif}
.sc{font-variant:small-caps}
p.first::first-letter{font-size:300%;float:left}
span.dropcap{font-size:300%;float:left}
.ind{margin-left:2em}
'''
fonts='/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'
FONT=open(fonts,'rb').read() if os.path.exists(fonts) else None
ch={}
ch['c1']=page('Headings and text','''<h1 id="h1">Heading one</h1><h2>Heading two</h2><h3>Heading three</h3><h4>Heading four</h4><h5>Heading five</h5><h6>Heading six</h6>
<p class="first">Dropcapped paragraph alpha begins here.</p>
<p><span class="dropcap">T</span>hen a span drop cap paragraph bravo follows.</p>
<p>Plain words with H<sub>2</sub>O and E=mc<sup>2</sup> and <span class="sc">Small Caps Words</span> here.</p>
<ul><li>Unordered one</li><li>Unordered two<ul><li>Nested unordered inner</li></ul></li></ul>
<ol><li>Ordered first</li><li>Ordered second<ol><li>Nested ordered inner</li></ol></li></ol>
<ol start="3"><li>Starts at three</li><li>Four with bullets<ul><li>Bullet under four</li></ul></li></ol><ol type="a"><li>Lettered first</li><li>Lettered second</li></ol><ol type="I"><li>Roman one</li><li>Roman two</li></ol>
<blockquote><p>Blockquote charlie paragraph.</p></blockquote>
<div class="poem"><p>Poem line one<br/>Poem line two<br/><span class="i1">Poem indented three</span><br/>Poem line four<br/><span style="margin-left:3em">Poem styled five</span></p><p>Plain paragraph after the poem.</p></div>
<pre>pre line one
  pre line two indented
pre line three</pre><p>Inline <code>code_sample()</code> here.</p>
<p>Ruby <ruby>漢<rp>(</rp><rt>kan</rt><rp>)</rp>字<rt>ji</rt></ruby> text after ruby.</p>
<p lang="ar" dir="rtl">مرحبا بالعالم</p><p lang="fr">Bonjour le monde francais.</p>
<p>Math before <math xmlns="http://www.w3.org/1998/Math/MathML"><mi>x</mi><mo>=</mo><mn>2</mn></math> math after.</p>
<p id="mid">Marker paragraph MIDPOINT in chapter one.</p>
<p>Page <span epub:type="pagebreak" id="pg7" title="7" role="doc-pagebreak"/>seven continues here.</p>
<p>Text break <span epub:type="pagebreak" id="pg8" title="8" role="doc-pagebreak">8</span>eight continues and <a epub:type="pagebreak" id="pg9" href="#pg9">9</a>nine too.</p>
<p>See <a href="c2.xhtml#tbl">the table in chapter two</a> and <a href="c2.xhtml">chapter two</a> links.</p>
<p>Last paragraph of chapter one ENDONE.</p>''')
ch['c2']=page('Tables figures notes','''<h1>Tables and pictures</h1>
<table id="tbl"><caption>Table caption zulu</caption><thead><tr><th>Head A</th><th>Head B</th></tr></thead><tbody><tr><td>Cell A1</td><td>Cell B1</td></tr><tr><td>Cell A2</td><td>Cell B2</td></tr></tbody></table>
<p>Before images.</p>
<p><img src="../Images/p.png" alt="png pic"/></p>
<p><img src="../Images/j.jpg" alt="jpg pic"/></p>
<p><img src="../Images/s.svg" alt="svg pic"/></p>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 32"><image width="64" height="32" xlink:href="../Images/p.png"/></svg>
<figure><img src="../Images/j.jpg" alt="fig pic"/><figcaption>Figure caption yankee.</figcaption></figure>
<p>Note text one<a epub:type="noteref" href="#n1" id="r1">1</a> and two<a epub:type="noteref" href="notes.xhtml#e2" id="r2">2</a> end.</p>
<aside epub:type="footnote" id="n1"><p><a href="#r1">1</a> Footnote one body. <a href="#r1" epub:type="backlink" role="doc-backlink">↩</a></p></aside>
<p>See <a href="c1.xhtml#mid">back to chapter one mid</a>.</p>''')
ch['c3']=page('Image only','<div><img src="../Images/p.png" alt="only image"/></div>')
ch['c4']=page('Non linear','<h1>Non linear item</h1><p>Appendix words NONLINEAR here.</p>')
ch['notes']=page('Endnotes','<h1>Endnotes</h1><ol><li id="e2" epub:type="endnote"><p>Endnote two body. <a href="c2.xhtml#r2">back</a></p></li></ol>')
ch['cover']=page('Cover','<div><img src="../Images/cover.jpg" alt="Cover"/></div>')
def build(out,v3):
    z=zipfile.ZipFile(out,'w'); z.writestr(zipfile.ZipInfo('mimetype'),'application/epub+zip')
    z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    man=['<item id="css" href="Styles/book.css" media-type="text/css"/>','<item id="ip" href="Images/p.png" media-type="image/png"/>','<item id="ij" href="Images/j.jpg" media-type="image/jpeg"/>','<item id="is" href="Images/s.svg" media-type="image/svg+xml"/>','<item id="ic" href="Images/cover.jpg" media-type="image/jpeg"%s/>'%(' properties="cover-image"' if v3 else '')]
    if FONT: man.append('<item id="f1" href="Fonts/BookFace.ttf" media-type="font/ttf"/>'); z.writestr('OEBPS/Fonts/BookFace.ttf',FONT)
    names=['cover','c1','c2','notes','c3','c4']
    for n in names: man.append(f'<item id="{n}" href="Text/{n}.xhtml" media-type="application/xhtml+xml"/>'); z.writestr(f'OEBPS/Text/{n}.xhtml',ch[n])
    spine=''.join(f'<itemref idref="{n}"'+(' linear="no"' if n=='c4' else '')+'/>' for n in names)
    if v3:
        man.append('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>')
        nav=f'<?xml version="1.0"?><html {NS}><body><nav epub:type="toc"><ol><li><a href="Text/c1.xhtml">Part One</a><ol><li><a href="Text/c1.xhtml#h1">Headings</a></li><li><a href="Text/c1.xhtml#mid">Midpoint of one</a><ol><li><a href="Text/c1.xhtml#pg7">Deep page seven</a></li></ol></li></ol></li><li><a href="Text/c2.xhtml">Tables</a></li><li><a href="Text/c3.xhtml">Image only</a></li></ol></nav><nav epub:type="page-list"><ol><li><a href="Text/c1.xhtml#pg7">7</a></li></ol></nav></body></html>'
        z.writestr('OEBPS/nav.xhtml',nav); tocattr=''
    else:
        man.append('<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'); tocattr=' toc="ncx"'
        def pt(i,t,src,kids=''): return f'<navPoint id="n{i}" playOrder="{i}"><navLabel><text>{t}</text></navLabel><content src="{src}"/>{kids}</navPoint>'
        ncx='<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1"><head/><docTitle><text>X</text></docTitle><navMap>'+pt(1,'Part One','Text/c1.xhtml',pt(2,'Headings','Text/c1.xhtml#h1')+pt(3,'Midpoint of one','Text/c1.xhtml#mid',pt(4,'Deep page seven','Text/c1.xhtml#pg7')))+pt(5,'Tables','Text/c2.xhtml')+pt(6,'Image only','Text/c3.xhtml')+'</navMap></ncx>'
        z.writestr('OEBPS/toc.ncx',ncx)
    z.writestr('OEBPS/Styles/book.css',CSS)
    z.writestr('OEBPS/Images/p.png',PNG); z.writestr('OEBPS/Images/j.jpg',JPG); z.writestr('OEBPS/Images/s.svg',SVG); z.writestr('OEBPS/Images/cover.jpg',COVER)
    meta='<dc:title>EpubCheck %s</dc:title><dc:language>en</dc:language><dc:creator>T. Author</dc:creator><dc:identifier id="id">x</dc:identifier>'%('3' if v3 else '2')
    if not v3: meta+='<meta name="cover" content="ic"/>'
    z.writestr('OEBPS/content.opf',f'<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="{"3.0" if v3 else "2.0"}" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">{meta}</metadata><manifest>{"".join(man)}</manifest><spine{tocattr}>{spine}</spine></package>')
    z.close()
build(os.path.join(here,'epubcheck3.epub'),True); build(os.path.join(here,'epubcheck2.epub'),False); print('ok')

# ---- epubcheck_edge.epub: awkward file names, entities, soft hyphens, inline pictures, nav in a sub-folder, last chapter a picture
def edge():
    z=zipfile.ZipFile(os.path.join(here,'epubcheck_edge.epub'),'w'); z.writestr(zipfile.ZipInfo('mimetype'),'application/epub+zip')
    z.writestr('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
    z.writestr('OEBPS/Text Files/ch one.xhtml', page('One','''<h1 id="a">Chapter&#160;One</h1>
<p>Entity text&nbsp;here &mdash; with a dash &copy; sign and extra&#173;ordinary soft&#173;hyphen words.</p>
<p>An inline glyph <img src="../Pics/my%20glyph.png" alt="glyph"/> sits mid sentence and the sentence ends here.</p>
<h2 id="一">Unicode id heading</h2><p>Words under the unicode heading UNIHEAD.</p>
<h1>Part<br/>Break Title</h1><p>Under part break.</p>'''))
    z.writestr('OEBPS/Text Files/ch two.xhtml', page('Two','<h1 id="b">Chapter Two</h1><p>Second chapter words SECOND here.</p>'))
    z.writestr('OEBPS/Text Files/last.xhtml', page('Pic','<div><img src="../Pics/my%20glyph.png" alt="last pic"/></div>'))
    z.writestr('OEBPS/Pics/my glyph.png',PNG)
    z.writestr('OEBPS/Nav/toc.xhtml', f'<?xml version="1.0"?><html {NS}><body><nav epub:type="toc"><ol><li><span>Group heading</span><ol><li><a href="../Text%20Files/ch%20one.xhtml#a">One</a></li><li><a href="../Text%20Files/ch%20one.xhtml#%E4%B8%80">Unicode heading</a></li></ol></li><li><a href="../Text%20Files/ch%20two.xhtml#b">Two</a></li><li><a href="../Text%20Files/last.xhtml">Last picture</a></li></ol></nav></body></html>')
    z.writestr('OEBPS/content.opf','<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Edge</dc:title><dc:language>en</dc:language><dc:identifier id="id">y</dc:identifier></metadata><manifest><item id="nav" href="Nav/toc.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="a" href="Text%20Files/ch%20one.xhtml" media-type="application/xhtml+xml"/><item id="b" href="Text%20Files/ch%20two.xhtml" media-type="application/xhtml+xml"/><item id="c" href="Text%20Files/last.xhtml" media-type="application/xhtml+xml"/><item id="p" href="Pics/my%20glyph.png" media-type="image/png"/></manifest><spine><itemref idref="a"/><itemref idref="b"/><itemref idref="c"/></spine></package>')
    z.close()
edge()
