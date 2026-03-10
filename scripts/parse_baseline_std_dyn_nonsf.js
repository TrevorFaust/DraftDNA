// Parse baseline data for standard dynasty non-superflex
const data = `1	Bijan Robinson	ATL	RB
2	Jahmyr Gibbs	DET	RB
3	Ja'Marr Chase	CIN	WR
4	Jaxon Smith-Njigba	SEA	WR
5	Puka Nacua	LAR	WR
6	Malik Nabers	NYG	WR
7	Amon-Ra St. Brown	DET	WR
8	Ashton Jeanty	LV	RB
9	Justin Jefferson	MIN	WR
10	2026 Pick 1.01	null	PICK
11	De'Von Achane	MIA	RB
12	Brock Bowers	LV	TE
13	Jeremiyah Love	null	RB
14	CeeDee Lamb	DAL	WR
15	Trey McBride	ARI	TE
16	Omarion Hampton	LAC	RB
17	Drake London	ATL	WR
18	Jonathan Taylor	IND	RB
19	Josh Allen	BUF	QB
20	James Cook	BUF	RB
21	Drake Maye	NE	QB
22	Tetairoa McMillan	CAR	WR
23	George Pickens	DAL	WR
24	Nico Collins	HOU	WR
25	Bucky Irving	TB	RB
26	2026 Pick 1.02	null	PICK
27	TreVeyon Henderson	NE	RB
28	Christian McCaffrey	SF	RB
29	Makai Lemon	null	WR
30	Carnell Tate	null	WR
31	Breece Hall	NYJ	RB
32	Colston Loveland	CHI	TE
33	Garrett Wilson	NYJ	WR
34	Chris Olave	NO	WR
35	Emeka Egbuka	TB	WR
36	2026 Pick 1.03	null	PICK
37	Quinshon Judkins	CLE	RB
38	Chase Brown	CIN	RB
39	Lamar Jackson	BAL	QB
40	Saquon Barkley	PHI	RB
41	Jayden Daniels	WAS	QB
42	Tyler Warren	IND	TE
43	Kyren Williams	LAR	RB
44	Ladd McConkey	LAC	WR
45	2026 Pick 1.04	null	PICK
46	Rashee Rice	KC	WR
47	Marvin Harrison Jr	ARI	WR
48	Joe Burrow	CIN	QB
49	Jordyn Tyson	null	WR
50	Caleb Williams	CHI	QB
51	Kenneth Walker	SEA	RB
52	Brian Thomas	JAX	WR
53	Josh Jacobs	GB	RB
54	Rome Odunze	CHI	WR
55	Cam Skattebo	NYG	RB
56	A.J. Brown	PHI	WR
57	Tee Higgins	CIN	WR
58	Justin Herbert	LAC	QB
59	Zay Flowers	BAL	WR
60	Jonah Coleman	null	RB
61	Jalen Hurts	PHI	QB
62	2026 Pick 1.05	null	PICK
63	Patrick Mahomes	KC	QB
64	Luther Burden	CHI	WR
65	Jameson Williams	DET	WR
66	Denzel Boston	null	WR
67	RJ Harvey	DEN	RB
68	Travis Etienne	JAX	RB
69	Harold Fannin	CLE	TE
70	2027 1st	null	PICK
71	Jaxson Dart	NYG	QB
72	Tucker Kraft	GB	TE
73	DeVonta Smith	PHI	WR
74	Javonte Williams	DAL	RB
75	Derrick Henry	BAL	RB
76	Jaylen Waddle	MIA	WR
77	2026 Pick 1.06	null	PICK
78	2026 1st	null	PICK
79	2026 Pick 1.07	null	PICK
80	Sam LaPorta	DET	TE
81	Bo Nix	DEN	QB
82	Trevor Lawrence	JAX	QB
83	KC Concepcion	null	WR
84	Kyle Pitts	ATL	TE
85	2026 Pick 1.08	null	PICK
86	Brock Purdy	SF	QB
87	Kenyon Sadiq	null	TE
88	Jadarian Price	null	RB
89	2026 Pick 1.09	null	PICK
90	D'Andre Swift	CHI	RB
91	Travis Hunter	JAX	WR
92	Emmett Johnson	null	RB
93	Jordan Love	GB	QB
94	2026 Pick 1.10	null	PICK
95	Oronde Gadsden	LAC	TE
96	Fernando Mendoza	null	QB
97	Jordan Addison	MIN	WR
98	2028 1st	null	PICK
99	DK Metcalf	PIT	WR
100	Ricky Pearsall	SF	WR
101	Nicholas Singleton	null	RB
102	Michael Pittman	IND	WR
103	Terry McLaurin	WAS	WR
104	Dak Prescott	DAL	QB
105	Davante Adams	LAR	WR
106	Alec Pierce	IND	WR
107	2026 Pick 1.11	null	PICK
108	Michael Wilson	ARI	WR
109	Bhayshul Tuten	JAX	RB
110	Kyle Monangai	CHI	RB
111	Matthew Golden	GB	WR
112	Jaylen Warren	PIT	RB
113	2026 Pick 1.12	null	PICK
114	Jayden Higgins	HOU	WR
115	Zach Charbonnet	SEA	RB
116	George Kittle	SF	TE
117	Tyler Allgeier	ATL	RB
118	Baker Mayfield	TB	QB
119	Cam Ward	TEN	QB
120	Xavier Worthy	KC	WR
121	Parker Washington	JAX	WR
122	Wan'Dale Robinson	NYG	WR
123	Christian Watson	GB	WR
124	Dalton Kincaid	BUF	TE
125	Jake Ferguson	DAL	TE
126	Chuba Hubbard	CAR	RB
127	Eli Stowers	null	TE
128	Trey Benson	ARI	RB
129	2026 Pick 2.01	null	PICK
130	Quentin Johnston	LAC	WR
131	C.J. Stroud	HOU	QB
132	Rico Dowdle	CAR	RB
133	Courtland Sutton	DEN	WR
134	Jared Goff	DET	QB
135	Blake Corum	LAR	RB
136	Mike Evans	TB	WR
137	2026 Pick 2.02	null	PICK
138	David Montgomery	DET	RB
139	Jakobi Meyers	JAX	WR
140	DJ Moore	CHI	WR
141	Rhamondre Stevenson	NE	RB
142	Mike Washington	null	RB
143	Omar Cooper	null	WR
144	Woody Marks	HOU	RB
145	Jonathon Brooks	CAR	RB
146	2026 Pick 2.03	null	PICK
147	Zachariah Branch	null	WR
148	Kenneth Gainwell	PIT	RB
149	Tyrone Tracy	NYG	RB
150	Sam Darnold	SEA	QB
151	Jayden Reed	GB	WR
152	Kaleb Johnson	PIT	RB
153	Demond Claiborne	null	RB
154	Khalil Shakir	BUF	WR
155	J.K. Dobbins	DEN	RB
156	Brandon Aiyuk	SF	WR
157	Chris Bell	null	WR
158	2026 Pick 2.04	null	PICK
159	Elijah Sarratt	null	WR
160	Josh Downs	IND	WR
161	Tyreek Hill	MIA	WR
162	Chris Brazzell	null	WR
163	Braelon Allen	NYJ	RB
164	Rachaad White	TB	RB
165	Brenton Strange	JAX	TE
166	Jalen Coker	CAR	WR
167	Jacory Croskey-Merritt	WAS	RB
168	Jauan Jennings	SF	WR
169	Alvin Kamara	NO	RB
170	Chris Godwin	TB	WR
171	Tyler Shough	NO	QB
172	2027 2nd	null	PICK
173	Bryce Young	CAR	QB
174	Romeo Doubs	GB	WR
175	2026 Pick 2.05	null	PICK
176	Tyjae Spears	TEN	RB
177	Germie Bernard	null	WR
178	Stefon Diggs	NE	WR
179	Troy Franklin	DEN	WR
180	Isaiah Likely	BAL	TE
181	Kayshon Boutte	NE	WR
182	Tony Pollard	TEN	RB
183	2026 Pick 2.06	null	PICK
184	Tre' Harris	LAC	WR
185	Pat Bryant	DEN	WR
186	Theo Johnson	NYG	TE
187	Ja'Kobi Lane	null	WR
188	2026 2nd	null	PICK
189	Kyler Murray	ARI	QB
190	Deebo Samuel	WAS	WR
191	2028 2nd	null	PICK
192	Keon Coleman	BUF	WR
193	Jerry Jeudy	CLE	WR
194	2026 Pick 2.07	null	PICK
195	Devin Neal	NO	RB
196	Mason Taylor	NYJ	TE
197	Antonio Williams	null	WR
198	Le'Veon Moss	null	RB
199	Elic Ayomanor	TEN	WR
200	Dylan Sampson	CLE	RB
201	Malachi Fields	null	WR
202	Terrance Ferguson	LAR	TE
203	David Njoku	CLE	TE
204	Chimere Dike	TEN	WR
205	Jordan Mason	MIN	RB
206	Adam Randall	null	RB
207	Matthew Stafford	LAR	QB
208	2026 Pick 2.08	null	PICK
209	AJ Barner	SEA	TE
210	Kimani Vidal	LAC	RB
211	T.J. Hockenson	MIN	TE
212	Jalen McMillan	TB	WR
213	Daniel Jones	IND	QB
214	Isaac TeSlaa	DET	WR
215	Max Klare	null	TE
216	Rashid Shaheed	SEA	WR
217	2026 Pick 2.09	null	PICK
218	Juwan Johnson	NO	TE
219	Mark Andrews	BAL	TE
220	J'Mari Taylor	null	RB
221	Tory Horton	SEA	WR
222	Dallas Goedert	PHI	TE
223	Adonai Mitchell	NYJ	WR
224	2026 Pick 2.10	null	PICK
225	Jaylin Noel	HOU	WR
226	J.J. McCarthy	MIN	QB
227	2026 Pick 2.11	null	PICK
228	Ollie Gordon	MIA	RB
229	Kyle Williams	NE	WR
230	2026 Pick 2.12	null	PICK
231	Eric McAlister	null	WR
232	CJ Daniels	null	WR
233	Michael Penix	ATL	QB
234	Tank Dell	HOU	WR
235	Malik Willis	GB	QB
236	2026 Pick 3.01	null	PICK
237	Ted Hurst	null	WR
238	Joe Mixon	HOU	RB
239	Sean Tucker	TB	RB
240	Deion Burks	null	WR
241	2026 Pick 3.02	null	PICK
242	Isiah Pacheco	KC	RB
243	Jack Bech	LV	WR
244	Gunnar Helm	TEN	TE
245	Tank Bigsby	PHI	RB
246	Brenen Thompson	null	WR
247	Aaron Jones	MIN	RB
248	Jack Endries	null	TE
249	Ty Simpson	null	QB
250	2026 Pick 3.03	null	PICK
251	2027 3rd	null	PICK
252	James Conner	ARI	RB
253	CJ Donaldson	null	RB
254	2026 Pick 3.04	null	PICK
255	2026 Pick 3.05	null	PICK
256	Shedeur Sanders	CLE	QB
257	2028 3rd	null	PICK
258	Brian Robinson	SF	RB
259	2026 Pick 3.06	null	PICK
260	2026 3rd	null	PICK
261	2026 Pick 3.07	null	PICK
262	Travis Kelce	KC	TE
263	Hunter Henry	NE	TE
264	Brashard Smith	KC	RB
265	Oscar Delp	null	TE
266	Jake Tonges	SF	TE
267	Tre Tucker	LV	WR
268	Tua Tagovailoa	MIA	QB
269	2026 Pick 3.08	null	PICK
270	Jaydon Blue	DAL	RB
271	Isaiah Bond	CLE	WR
272	2026 Pick 3.09	null	PICK
273	2026 Pick 3.10	null	PICK
274	2026 Pick 3.11	null	PICK
275	Mac Jones	SF	QB
276	Kevin Coleman	null	WR
277	2026 Pick 3.12	null	PICK
278	Colby Parkinson	LAR	TE
279	2028 4th	null	PICK
280	Dalton Schultz	HOU	TE
281	2026 Pick 4.01	null	PICK
282	2027 4th	null	PICK
283	2026 Pick 4.02	null	PICK
284	Ben Sinnott	WAS	TE
285	Cade Otton	TB	TE
286	Noah Thomas	null	WR
287	Marlin Klein	null	TE
288	Jaylen Wright	MIA	RB
289	Tez Johnson	TB	WR
290	Marvin Mims	DEN	WR
291	Najee Harris	LAC	RB
292	2026 Pick 4.03	null	PICK
293	Hollywood Smothers	null	RB
294	Anthony Richardson	IND	QB
295	Emanuel Wilson	GB	RB
296	Elijah Arroyo	SEA	TE
297	2026 Pick 4.04	null	PICK
298	Josh Cameron	null	WR
299	Carson Beck	null	QB
300	2026 Pick 4.05	null	PICK
301	Dylan Devezin	null	RB
302	Keaton Mitchell	BAL	RB
303	2026 Pick 4.06	null	PICK
304	Dane Key	null	WR
305	Dont'e Thornton	LV	WR
306	2026 4th	null	PICK
307	2026 Pick 4.07	null	PICK
308	Xavier Legette	CAR	WR
309	2026 Pick 4.08	null	PICK
310	2026 Pick 4.09	null	PICK
311	2026 Pick 4.10	null	PICK
312	Aaron Anderson	null	WR
313	2026 Pick 4.11	null	PICK
314	2026 Pick 4.12	null	PICK
315	Evan Engram	DEN	TE
316	Pat Freiermuth	PIT	TE
317	Michael Mayer	LV	TE
318	Malik Washington	MIA	WR
319	Kendre Miller	NO	RB
320	Chris Rodriguez	WAS	RB
321	Keenan Allen	LAC	WR
322	Jacoby Brissett	ARI	QB
323	DJ Giddens	IND	RB
324	Calvin Ridley	TEN	WR
325	Isaiah Davis	NYJ	RB
326	Chig Okonkwo	TEN	TE
327	Devaughn Vele	NO	WR
328	Audric Estime	NO	RB
329	Cooper Kupp	SEA	WR
330	Drew Allar	null	QB
331	Cole Kmet	CHI	TE
332	Aaron Rodgers	PIT	QB
333	Justin Fields	NYJ	QB
334	Cedric Tillman	CLE	WR
335	Ja'Tavion Sanders	CAR	TE
336	Darren Waller	MIA	TE
337	Rashod Bateman	BAL	WR
338	Kirk Cousins	ATL	QB
339	Kareem Hunt	KC	RB
340	Dontayvion Wicks	GB	WR
341	Ryan Flournoy	DAL	WR
342	Taylen Green	null	QB
343	Jalen Milroe	SEA	QB
344	Darnell Mooney	ATL	WR
345	Ray Davis	BUF	RB
346	Devin Singletary	NYG	RB
347	John Metchie	NYJ	WR
348	Zach Ertz	WAS	TE
349	Will Howard	PIT	QB
350	Tahj Brooks	CIN	RB
351	DeMario Douglas	NE	WR
352	Jordan James	SF	RB
353	Cade Klubnik	null	QB
354	Riley Leonard	IND	QB
355	Joe Fagnano	null	QB
356	Trevor Etienne	CAR	RB
357	Quinn Ewers	MIA	QB
358	Jalen Royals	KC	WR
359	Christian Kirk	HOU	WR
360	Marquise Brown	KC	WR
361	Geno Smith	LV	QB
362	Zonovan Knight	ARI	RB
363	LeQuint Allen	JAX	RB
364	Jaylin Lane	WAS	WR
365	Michael Carter	ARI	RB
366	Roman Wilson	PIT	WR
367	Darius Slayton	NYG	WR
368	Jalen Nailor	MIN	WR
369	Luke McCaffrey	WAS	WR
370	Darnell Washington	PIT	TE
371	MarShawn Lloyd	GB	RB
372	Deshaun Watson	CLE	QB
373	Nick Chubb	HOU	RB
374	Ja'Lynn Polk	NO	WR
375	Jarquez Hunter	LAR	RB
376	Marcus Mariota	WAS	QB
377	KeAndre Lambert-Smith	LAC	WR
378	Luke Musgrave	GB	TE
379	Dillon Gabriel	CLE	QB
380	Noah Gray	KC	TE
381	Jonnu Smith	PIT	TE
382	Andrei Iosivas	CIN	WR
383	Savion Williams	GB	WR
384	Dawson Knox	BUF	TE
385	Joe Milton	DAL	QB
386	Calvin Austin	PIT	WR
387	Jerome Ford	CLE	RB
388	Mike Gesicki	CIN	TE
389	Jameis Winston	NYG	QB
390	Davis Mills	HOU	QB
391	Isaac Guerendo	SF	RB
392	Jimmy Horn	CAR	WR
393	Efton Chism	NE	WR
394	Spencer Rattler	NO	QB
395	Xavier Hutchinson	HOU	WR
396	Will Levis	TEN	QB
397	Justice Hill	BAL	RB
398	Max Brosmer	MIN	QB
399	Tyler Higbee	LAR	TE
400	Joe Flacco	CIN	QB
401	Malik Davis	DAL	RB
402	Greg Dulcich	MIA	TE
403	Raheim Sanders	CLE	RB
404	Mack Hollins	NE	WR
405	Trey Lance	LAC	QB
406	Treylon Burks	WAS	WR
407	Xavier Restrepo	TEN	WR
408	Jawhar Jordan	HOU	RB
409	Austin Ekeler	WAS	RB
410	Samaje Perine	CIN	RB
411	Ty Johnson	BUF	RB
412	Noah Fant	CIN	TE
413	Nathan Carter	ATL	RB
414	Tyson Bagent	CHI	QB
415	KaVontae Turpin	DAL	WR
416	Jordan Whittington	LAR	WR
417	Tyquan Thornton	KC	WR
418	Roschon Johnson	CHI	RB
419	Will Shipley	PHI	RB
420	Tanner McKee	PHI	QB
421	Jahan Dotson	PHI	WR
422	Konata Mumpfield	LAR	WR
423	Tutu Atwell	LAR	WR
424	Jahdae Walker	CHI	WR
425	Phil Mafah	DAL	RB
426	Jordan Watkins	SF	WR
427	Tai Felton	MIN	WR
428	DeAndre Hopkins	BAL	WR
429	Russell Wilson	NYG	QB
430	Tyler Huntley	BAL	QB
431	Erick All	CIN	TE
432	Terrell Jennings	NE	RB
433	Joshua Palmer	BUF	WR
434	Tyrod Taylor	NYJ	QB
435	Isaiah Williams	NYJ	WR
436	Mitchell Evans	CAR	TE
437	Derek Carr	null	QB
438	Jackson Hawes	BUF	TE
439	Jimmy Garoppolo	LAR	QB
440	Malachi Corley	CLE	WR
441	Olamide Zaccheaus	CHI	WR
442	Darius Cooper	PHI	WR
443	Demarcus Robinson	SF	WR
444	Jarrett Stidham	DEN	QB
445	Sam Howell	PHI	QB
446	George Holani	SEA	RB
447	Stetson Bennett	LAR	QB`;

function escape(name) {
  return name.replace(/'/g, "''");
}

const lines = data.trim().split('\n');
const rows = [];
for (const line of lines) {
  const parts = line.split('\t');
  const rank = parseInt(parts[0], 10);
  const name = parts[1];
  const team = parts[2];
  const position = parts[3];
  if (position === 'PICK') continue;
  const is_fa = team === 'null' || !team;
  rows.push({ rank, name, position, is_fa });
}

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const nameEsc = `('${escape(r.name)}', '${r.position}', ${r.rank}::numeric, ${r.is_fa})`;
  console.log(`    ${nameEsc}${i < rows.length - 1 ? ',' : ''}`);
}
