import re
path = r"d:\Work\Projects\Lexiquest\lexiquest.html"
d = "div"
with open(path, "r", encoding="utf-8") as f:
    html = f.read()

replacement = f"""
        <{d} class="screen" id="screen-onboarding"><{d} id="onboarding-wrap"></{d}></{d}>
        <{d} class="screen" id="screen-mock" style="background:#0D0D0D"><{d} class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Mock Test</h2></{d}><{d} class="screen-panel" id="mock-wrap"></{d}></{d}>
        <{d} class="screen" id="screen-drill" style="background:#0D0D0D"><{d} class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Weak Drill</h2></{d}><{d} class="screen-panel" id="drill-wrap"></{d}></{d}>
        <{d} class="screen" id="screen-leagues" style="background:#0D0D0D"><{d} class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>League</h2></{d}><{d} class="screen-panel" id="league-wrap"></{d}></{d}>
        <{d} class="screen" id="screen-speak" style="background:#0D0D0D"><{d} class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Speak</h2></{d}><{d} class="screen-panel" id="speak-wrap"></{d}></{d}>
        <{d} class="screen" id="screen-settings" style="background:#0D0D0D"><{d} class="fc-header"><button class="back-btn" onclick="goTo('home')">←</button><h2>Settings</h2></{d}><{d} class="screen-panel" id="settings-wrap"></{d}></{d}>
"""

html = re.sub(
    r'\n\s*<(?:div|class)[^>]*screen-onboarding.*?(?=\n\s*<!-- ══ SPELLING)',
    "\n" + replacement,
    html,
    count=1,
    flags=re.DOTALL,
)

html = html.replace(
    '<script src="js/native-bridge.js"></script>\n<script src="js/native-bridge.js"></script>',
    '<script src="js/native-bridge.js"></script>',
)
html = html.replace('onclick="toggleNotif()"', 'onclick="LQ.toggleNotif()"')

with open(path, "w", encoding="utf-8") as f:
    f.write(html)
print("fixed")
