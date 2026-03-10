#!/usr/bin/env python3
"""
Parse standard/season/non-superflex baseline rankings and output SQL for migration.
Format: RK, WSID, Player Name, POS, BEST, WORST, AVG (index 6) - no AGE column.
FA players -> baseline_rookies for standard/season/non-superflex if not in players.
"""

import re
import sys

# Raw data: tab-separated. Cols: RK, WSID, Player Name, POS, BEST, WORST, AVG (index 6), STD.DEV, ECR
RAW = """1		Bijan Robinson (ATL)	RB1	1	1	1	0	-
2		Puka Nacua (LAR)	WR1	2	2	2	0	-
3		Jahmyr Gibbs (DET)	RB2	3	3	3	0	-
4		Ja'Marr Chase (CIN)	WR2	4	6	4.7	0.9	-
5		Jaxon Smith-Njigba (SEA)	WR3	4	6	5.3	0.9	-
6		Jonathan Taylor (IND)	RB3	5	8	7	1.4	-
7		Christian McCaffrey (SF)	RB4	5	12	7.7	2.4	-
8		Amon-Ra St. Brown (DET)	WR4	7	10	8.5	1.1	-
9		CeeDee Lamb (DAL)	WR5	7	10	8.8	0.9	-
10		Malik Nabers (NYG)	WR6	7	11	10.2	1.5	-
11		James Cook III (BUF)	RB5	8	13	11.8	1.8	-
12		Drake London (ATL)	WR7	9	18	12.2	3	-
13		De'Von Achane (MIA)	RB6	12	13	12.3	0.5	-
14		Nico Collins (HOU)	WR8	11	18	14.8	2.5	-
15		Ashton Jeanty (LV)	RB7	15	20	16.5	1.8	-
16		George Pickens (DAL)	WR9	14	19	18	1.8	-
17		Brock Bowers (LV)	TE1	16	22	19	3	-
18		Rashee Rice (KC)	WR10	14	26	19.8	4	-
19		Justin Jefferson (MIN)	WR11	14	26	20.2	3.6	-
20		Derrick Henry (BAL)	RB8	17	28	20.8	3.8	-
21		Omarion Hampton (LAC)	RB9	17	30	22.5	5.1	-
22		Saquon Barkley (PHI)	RB10	15	30	24	5.3	-
23		Josh Allen (BUF)	QB1	25	25	25	0	-
24		Chris Olave (NO)	WR12	21	38	25.7	5.8	-
25		Tee Higgins (CIN)	WR13	24	32	26.3	2.7	-
26		Josh Jacobs (GB)	RB11	23	37	28.2	4.7	-
27		Lamar Jackson (BAL)	QB2	27	29	28.3	0.9	-
28		Drake Maye (NE)	QB3	27	36	29.2	3.2	-
29		Trey McBride (ARI)	TE2	16	56	30.3	18.3	-
30		Chase Brown (CIN)	RB12	17	37	30.8	6.9	-
31		Tetairoa McMillan (CAR)	WR14	21	38	31.2	5.2	-
32		A.J. Brown (PHI)	WR15	24	39	31.7	4.3	-
33		Breece Hall (NYJ)	RB13	23	40	32.7	6	-
34		Tucker Kraft (GB)	TE3	22	56	33.7	11.3	-
35		Davante Adams (LAR)	WR16	32	39	35.8	2.5	-
36		Joe Burrow (CIN)	QB4	29	53	37.7	7.3	-
37		Bucky Irving (TB)	RB14	33	45	38.7	3.7	-
38		Garrett Wilson (NYJ)	WR17	35	44	40	3.1	-
39		Kyren Williams (LAR)	RB15	37	42	40.8	1.9	-
40		Jameson Williams (DET)	WR18	38	46	40.8	3.2	-
41		Kenneth Walker III (SEA)	RB16	33	49	41.2	6.4	-
42		Colston Loveland (CHI)	TE4	34	56	41.3	10.4	-
43		Jaylen Waddle (MIA)	WR19	41	48	45.7	2.8	-
44		Ladd McConkey (LAC)	WR20	41	51	46.3	4.5	-
45		Zay Flowers (BAL)	WR21	44	50	47	2.5	-
46		Christian Watson (GB)	WR22	43	54	48.5	4.3	-
47		Terry McLaurin (WAS)	WR23	43	61	48.7	5.9	-
48		Travis Etienne Jr. (JAC)	RB17	45	57	49.3	5	-
49		TreVeyon Henderson (NE)	RB18	42	55	49.8	4.1	-
50		Javonte Williams (DAL)	RB19	45	57	50.8	3.9	-
51		RJ Harvey (DEN)	RB20	47	55	51.3	3.3	-
52		Cam Skattebo (NYG)	RB21	47	55	52.2	3.2	-
53		Jayden Daniels (WAS)	QB5	36	68	52.7	9.3	-
54		Mike Evans (TB)	WR24	48	65	55.3	7.1	-
55		Jalen Hurts (PHI)	QB6	53	62	57.8	2.6	-
56		Luther Burden III (CHI)	WR25	51	65	58.2	4.6	-
57		Quinshon Judkins (CLE)	RB22	55	60	58.7	2	-
58		DeVonta Smith (PHI)	WR26	50	69	59	7.1	-
59		Emeka Egbuka (TB)	WR27	51	69	59.8	6.1	-
60		D'Andre Swift (CHI)	RB23	57	63	60	2.5	-
61		Courtland Sutton (DEN)	WR28	51	75	61	10.1	-
62		Rome Odunze (CHI)	WR29	39	81	64	13.7	-
63		Jaxson Dart (NYG)	QB7	58	79	64.2	6.8	-
64		Jaylen Warren (PIT)	RB24	63	71	65.3	2.7	-
65		Justin Herbert (LAC)	QB8	62	79	68.8	5	-
66		DK Metcalf (PIT)	WR30	59	74	70.2	5.3	-
67		Blake Corum (LAR)	RB25	64	78	70.2	4.5	-
68		Kyle Monangai (CHI)	RB26	66	77	71.5	4.5	-
69		Tyler Warren (IND)	TE5	67	76	71.5	4.5	-
70		Harold Fannin Jr. (CLE)	TE6	67	76	71.5	4.5	-
71		Rhamondre Stevenson (NE)	RB27	64	87	76.8	9.8	-
72		Denzel Boston (FA)	WR31	65	89	78	11.1	-
73		Trevor Lawrence (JAC)	QB9	68	90	79	9	-
74		Brian Thomas Jr. (JAC)	WR32	69	88	79.5	7.9	-
75		Bhayshul Tuten (JAC)	RB28	66	85	80	6.9	-
76		Caleb Williams (CHI)	QB10	68	100	81.2	13.4	-
77		Rico Dowdle (CAR)	RB29	72	92	81.7	6.9	-
78		Tony Pollard (TEN)	RB30	78	92	82.3	4.7	-
79		Alec Pierce (IND)	WR33	75	93	82.8	7.1	-
80		Marvin Harrison Jr. (ARI)	WR34	74	93	83.5	7.7	-
81		Sam LaPorta (DET)	TE7	84	86	84.3	0.8	-
82		Michael Wilson (ARI)	WR35	81	93	86.3	4.8	-
83		Patrick Mahomes II (KC)	QB11	73	97	87.7	8.9	-
84		Jacory Croskey-Merritt (WAS)	RB31	82	99	89	6.1	-
85		Kyle Pitts Sr. (ATL)	TE8	86	96	90.3	4.4	-
86		Jordan Addison (MIN)	WR36	81	109	91.7	10.4	-
87		Dak Prescott (DAL)	QB12	79	100	92.2	7	-
88		Brock Purdy (SF)	QB13	79	100	92.2	7	-
89		Brandon Aiyuk (SF)	WR37	75	122	92.8	16.2	-
90		Woody Marks (HOU)	RB32	77	108	93.2	11.7	-
91		Zach Charbonnet (SEA)	RB33	63	161	93.7	37.2	-
92		Dalton Kincaid (BUF)	TE9	86	96	93.7	3.5	-
93		Ricky Pearsall (SF)	WR38	83	106	96.2	8.8	-
94		Quentin Johnston (LAC)	WR39	88	114	96.2	8.5	-
95		Carnell Tate (FA)	WR40	31	173	96.8	57.5	-
96		Oronde Gadsden II (LAC)	TE10	94	105	98.3	4.8	-
97		Chris Godwin Jr. (TB)	WR41	88	109	99.2	8.6	-
98		Jakobi Meyers (JAC)	WR42	89	114	99.3	8.6	-
99		Chuba Hubbard (CAR)	RB34	82	113	99.5	12.2	-
100		Jordyn Tyson (FA)	WR43	35	162	99.8	54.2	-
101		Stefon Diggs (NE)	WR44	89	115	100.7	10.8	-
102		David Montgomery (DET)	RB35	95	113	101.3	7.1	-
103		Matthew Stafford (LAR)	QB14	103	112	104.8	3.2	-
104		Aaron Jones Sr. (MIN)	RB36	99	117	105	6.7	-
105		Bo Nix (DEN)	QB15	103	107	105.3	1.7	-
106		James Conner (ARI)	RB37	92	117	105.5	10.8	-
107		K.C. Concepcion (FA)	WR45	75	149	106	27.6	-
108		Tyler Allgeier (ATL)	RB38	87	119	108.7	10.5	-
109		Michael Pittman Jr. (IND)	WR46	101	116	108.8	4.3	-
110		Jordan Love (GB)	QB16	103	124	109	7.3	-
111		Makai Lemon (FA)	WR47	41	179	109.7	53.1	-
112		Jauan Jennings (SF)	WR48	98	125	110	9.3	-
113		Jared Goff (DET)	QB17	107	118	111.3	3.7	-
114		Braelon Allen (NYJ)	RB39	102	121	111.8	8.1	-
115		Parker Washington (JAC)	WR49	81	132	112.5	17.3	-
116		Brenton Strange (JAC)	TE11	96	123	113.3	10.5	-
117		DJ Moore (CHI)	WR50	101	135	115.5	11	-
118		Jake Ferguson (DAL)	TE12	105	157	117.2	17.9	-
119		Baker Mayfield (TB)	QB18	112	128	119.7	5.1	-
120		Juwan Johnson (NO)	TE13	110	130	121.2	8.1	-
121		Dallas Goedert (PHI)	TE14	111	137	123.7	9.8	-
122		Jayden Higgins (HOU)	WR51	114	149	124	14.2	-
123		J.K. Dobbins (DEN)	RB40	117	143	124.5	10.3	-
124		Jordan Mason (MIN)	RB41	117	141	125.3	8	-
125		Wan'Dale Robinson (NYG)	WR52	116	135	125.8	7	-
126		Malik Willis (GB)	QB19	107	136	126.2	9.7	-
127		George Kittle (SF)	TE15	86	172	126.7	27.8	-
128		Tyler Shough (NO)	QB20	118	133	128	5	-
129		Jeremiyah Love (FA)	RB42	17	250	128.8	109	-
130		Alvin Kamara (NO)	RB43	121	140	129.8	6.1	-
131		Tyrone Tracy Jr. (NYG)	RB44	121	141	130.2	7.6	-
132		Trey Benson (ARI)	RB45	113	140	131	8.5	-
133		Tyreek Hill (FA)	WR53	116	173	131	19.4	-
134		C.J. Stroud (HOU)	QB21	124	146	133.8	6.9	-
135		Hunter Henry (NE)	TE16	123	144	134.7	6.6	-
136		Khalil Shakir (BUF)	WR54	129	149	134.8	7	-
137		Xavier Worthy (KC)	WR55	129	147	136	5.7	-
138		Kaleb Johnson (PIT)	RB46	126	148	136.7	8.4	-
139		Deebo Samuel Sr. (WAS)	WR56	125	169	137.5	15	-
140		Sam Darnold (SEA)	QB22	136	146	141	5	-
141		Jayden Reed (GB)	WR57	122	164	141.3	16.9	-
142		Travis Hunter (JAC)	WR58	115	200	142.8	29	-
143		Dylan Sampson (CLE)	RB47	141	151	143	3.6	-
144		Tank Bigsby (PHI)	RB48	131	159	143.2	11.7	-
145		Kyler Murray (ARI)	QB23	124	158	143.7	11	-
146		Kenneth Gainwell (PIT)	RB49	140	151	144.3	3.9	-
147		Josh Downs (IND)	WR59	138	168	145.5	10.5	-
148		Cam Ward (TEN)	QB24	136	158	149.3	6.9	-
149		Jalen Coker (CAR)	WR60	139	169	149.3	10.2	-
150		Houston Texans (HOU)	DST1	150	150	150	0	-
151		Troy Franklin (DEN)	WR61	135	194	152	21.3	-
152		Mark Andrews (BAL)	TE17	154	157	154.5	1.1	-
153		Adonai Mitchell (NYJ)	WR62	147	173	155.7	9.9	-
154		Kimani Vidal (LAC)	RB50	145	181	157.2	11.3	-
155		Tyjae Spears (TEN)	RB51	151	163	157.5	4	-
156		Rachaad White (TB)	RB52	148	181	157.7	12.3	-
157		Joe Mixon (HOU)	RB53	140	218	158.2	27.7	-
158		Dalton Schultz (HOU)	TE18	144	172	159.3	10	-
159		Denver Broncos (DEN)	DST2	160	166	161	2.2	-
160		Isiah Pacheco (KC)	RB54	145	188	163.3	13.9	-
161		Keaton Mitchell (BAL)	RB55	155	196	164.2	14.5	-
162		Kayshon Boutte (NE)	WR63	162	169	164.7	2.9	-
163		Brian Robinson Jr. (SF)	RB56	159	174	164.8	5.2	-
164		Seattle Seahawks (SEA)	DST3	160	166	165	2.2	-
165		Travis Kelce (KC)	TE19	144	195	165.3	18.8	-
166		Jonathon Brooks (CAR)	RB57	131	181	167.7	17.5	-
167		Romeo Doubs (GB)	WR64	147	179	169.7	11.1	-
168		Jerry Jeudy (CLE)	WR65	153	198	170	13.9	-
169		Philadelphia Eagles (PHI)	DST4	170	171	170.8	0.4	-
170		Los Angeles Rams (LAR)	DST5	170	182	172	4.5	-
171		Tank Dell (HOU)	WR66	162	179	172.3	5.8	-
172		Jaylen Wright (MIA)	RB58	163	188	172.5	8.2	-
173		Rashid Shaheed (SEA)	WR67	168	183	173.3	6.8	-
174		Chimere Dike (TEN)	WR68	165	194	173.5	9.9	-
175		Sean Tucker (TB)	RB59	163	181	173.7	6.7	-
176		Terrance Ferguson (LAR)	TE20	130	202	174	24.2	-
177		Kendre Miller (NO)	RB60	155	227	174	24.7	-
178		Bryce Young (CAR)	QB25	152	213	176.2	19.5	-
179		Fernando Mendoza (FA)	QB26	146	254	177.5	44.4	-
180		Devin Neal (NO)	RB61	159	207	180.8	14.6	-
181		Chris Rodriguez Jr. (WAS)	RB62	161	230	181.2	27.3	-
182		Elic Ayomanor (TEN)	WR69	173	203	181.3	10.2	-
183		Minnesota Vikings (MIN)	DST6	182	182	182	0	-
184		Isaac TeSlaa (DET)	WR70	169	229	183.7	20.5	-
185		Theo Johnson (NYG)	TE21	172	195	183.7	8.5	-
186		New England Patriots (NE)	DST7	184	184	184	0	-
187		Jacksonville Jaguars (JAC)	DST8	185	185	185	0	-
188		Isaiah Likely (BAL)	TE22	157	225	186	22.1	-
189		Brandon Aubrey (DAL)	K1	186	186	186	0	-
190		Los Angeles Chargers (LAC)	DST9	187	187	187	0	-
191		J.J. McCarthy (MIN)	QB27	158	241	189	37.4	-
192		Green Bay Packers (GB)	DST10	189	189	189	0	-
193		Pittsburgh Steelers (PIT)	DST11	190	190	190	0	-
194		Ka'imi Fairbairn (HOU)	K2	191	191	191	0	-
195		Cam Little (JAC)	K3	192	192	192	0	-
196		Jaylin Noel (HOU)	WR71	179	209	192.8	9.8	-
197		Cleveland Browns (CLE)	DST12	193	205	195	4.5	-
198		Matthew Golden (GB)	WR72	179	201	196	7.7	-
199		Kyle Williams (NE)	WR73	177	223	197	18.7	-
200		Cameron Dicker (LAC)	K4	197	197	197	0	-
201		Emanuel Wilson (GB)	RB63	176	227	199.3	18.5	-
202		Jadarian Price (FA)	RB64	64	95	81.3	12.9	-
203		AJ Barner (SEA)	TE23	195	202	200.8	2.6	-
204		Evan McPherson (CIN)	K5	199	206	201.3	3.3	-
205		Tre Harris (LAC)	WR74	183	223	201.8	13.3	-
206		Jason Myers (SEA)	K6	206	210	206.7	1.5	-
207		Tre Tucker (LV)	WR75	201	220	207.5	7.3	-
208		Kansas City Chiefs (KC)	DST13	205	211	208	3	-
209		Tyler Loop (BAL)	K7	199	212	208.8	4.5	-
210		Emmett Johnson (FA)	RB65	71	145	98	33.4	-
211		Tory Horton (SEA)	WR76	203	226	209.7	8.8	-
212		Andy Borregales (NE)	K8	210	212	211.3	0.9	-
213		Ryan Flournoy (DAL)	WR77	203	222	211.7	8.8	-
214		Detroit Lions (DET)	DST14	193	247	212	16.8	-
215		Ray Davis (BUF)	RB66	196	242	212.5	17.9	-
216		Pat Bryant (DEN)	WR78	201	223	213.3	6.9	-
217		Eddy Pineiro (SF)	K9	214	214	214	0	-
218		Jonah Coleman (FA)	RB67	82	145	113.3	25.7	-
219		Chase McLaughlin (TB)	K10	216	224	217.3	3	-
220		Buffalo Bills (BUF)	DST15	219	219	219	0	-
221		Isaiah Davis (NYJ)	RB68	161	240	219.7	26.6	-
222		T.J. Hockenson (MIN)	TE24	208	251	219.7	17.1	-
223		Darnell Mooney (ATL)	WR79	204	238	222	10.4	-
224		Michael Penix Jr. (ATL)	QB28	213	241	222.3	13.2	-
225		Keon Coleman (BUF)	WR80	209	238	223.2	10.2	-
226		Daniel Jones (IND)	QB29	152	275	223.5	43.5	-
227		Rashod Bateman (BAL)	WR81	215	244	224.2	9.6	-
228		Jalen McMillan (TB)	WR82	217	238	224.8	7.3	-
229		Cairo Santos (CHI)	K11	224	233	225.5	3.4	-
230		Calvin Ridley (TEN)	WR83	201	244	225.7	17.7	-
231		Ollie Gordon II (MIA)	RB69	218	250	227.5	12.8	-
232		Najee Harris (LAC)	RB70	188	262	228	21.6	-
233		Mack Hollins (NE)	WR84	222	244	231	8.7	-
234		Marvin Mims Jr. (DEN)	WR85	226	246	232.2	7.2	-
235		David Njoku (CLE)	TE25	225	253	232.3	9.8	-
236		Jaleel McLaughlin (DEN)	RB71	218	262	233.5	16.1	-
237		Xavier Legette (CAR)	WR86	226	246	234.7	8.1	-
238		Kenyon Sadiq (FA)	TE26	105	235	150.3	59.9	-
239		Harrison Mevis (LAR)	K12	233	248	235.5	5.6	-
240		Mason Taylor (NYJ)	TE27	225	255	236	10.7	-
241		Baltimore Ravens (BAL)	DST16	234	248	236.3	5.2	-
242		Dontayvion Wicks (GB)	WR87	229	254	236.7	9.2	-
243		Colby Parkinson (LAR)	TE28	228	245	237.7	7.7	-
244		Isaac Guerendo (SF)	RB72	207	257	221.6	19.8	-
245		Jake Bates (DET)	K13	233	239	238	2.2	-
246		Ty Johnson (BUF)	RB73	236	270	245.2	11.7	-
247		Darius Slayton (NYG)	WR88	238	279	248.8	15.1	-
248		Gunnar Helm (TEN)	TE29	235	256	249.5	7.4	-
249		Isaiah Bond (CLE)	WR89	237	295	250.7	20.2	-
250		Chris Boswell (PIT)	K14	251	251	251	0	-
251		Cooper Kupp (SEA)	WR90	243	276	251.5	12.1	-
252		Brashard Smith (KC)	RB74	236	270	252.8	12.6	-
253		Chig Okonkwo (TEN)	TE30	253	256	254.5	1.5	-
254		Keenan Allen (LAC)	WR91	237	266	254.8	10.1	-
255		DJ Giddens (IND)	RB75	240	300	254.8	20.6	-
256		Pat Freiermuth (PIT)	TE31	253	260	255.2	2.3	-
257		Omar Cooper Jr. (FA)	WR92	115	147	131	16	-
258		Malik Davis (DAL)	RB76	232	293	247	23.3	-
259		Wil Lutz (DEN)	K15	252	281	259.7	11.4	-
260		Atlanta Falcons (ATL)	DST17	234	279	260.8	18.1	-
261		Eli Stowers (FA)	TE32	157	245	203.3	36.1	-
262		Jaydon Blue (DAL)	RB77	221	306	261.7	30.4	-
263		Charlie Smyth (NO)	K16	249	252	250.2	1.5	-
264		Malachi Fields (FA)	WR93	142	164	153	11	-
265		Harrison Butker (KC)	K17	249	281	264.3	15.4	-
266		Mike Washington Jr. (FA)	RB78	151	161	156	5	-
267		Chris Brazzell II (FA)	WR94	114	201	157.5	43.5	-
268		Shedeur Sanders (CLE)	QB30	254	313	267.8	22	-
269		George Holani (SEA)	RB79	207	325	269.3	34.2	-
270		Jake Tonges (SF)	TE33	235	280	258.6	16.8	-
271		New Orleans Saints (NO)	DST18	248	278	269.5	11.3	-
272		Kaytron Allen (FA)	RB80	131	207	169	38	-
273		Devaughn Vele (NO)	WR95	244	304	270.7	17.5	-
274		Andrei Iosivas (CIN)	WR96	246	288	261.2	15.4	-
275		Luke McCaffrey (WAS)	WR97	264	292	271	9.6	-
276		Konata Mumpfield (LAR)	WR98	258	289	271.5	11.2	-
277		Bam Knight (ARI)	RB81	247	296	264.2	16.7	-
278		San Francisco 49ers (SF)	DST19	211	279	250.8	29.4	-
279		Jarquez Hunter (LAR)	RB82	250	309	264.6	22.4	-
280		Cade Otton (TB)	TE34	267	291	274.2	8.9	-
281		Audric Estime (NO)	RB83	259	286	266.2	10.2	-
282		Evan Engram (DEN)	TE35	260	290	275.5	11.7	-
283		MarShawn Lloyd (GB)	RB84	257	303	268	17.6	-
284		Elijah Sarratt (FA)	WR99	168	215	191.5	23.5	-
285		Jack Bech (LV)	WR100	268	301	277.5	12.2	-
286		Marquise Brown (KC)	WR101	271	306	277.8	12.7	-
287		Tyquan Thornton (KC)	WR102	261	298	270	14	-
288		Nicholas Singleton (FA)	RB85	188	207	197.5	9.5	-
289		Tommy Myers (FA)	TE36	208	256	240	22.6	-
290		Germie Bernard (FA)	WR103	200	203	201.5	1.5	-
291		Calvin Austin III (PIT)	WR104	264	297	272.6	12.3	-
292		Zachariah Branch (FA)	WR105	203	204	203.5	0.5	-
293		Devin Singletary (NYG)	RB86	265	310	275	17.6	-
294		Christian Kirk (HOU)	WR106	272	288	276	6.2	-
295		Ben Sinnott (WAS)	TE37	225	348	274.5	45.2	-
296		Cedric Tillman (CLE)	WR107	272	314	286.2	13.4	-
297		Mike Gesicki (CIN)	TE38	267	299	282.4	13.3	-
298		Trevor Etienne (CAR)	RB87	274	313	284	14.8	-
299		Mac Jones (SF)	QB31	284	311	290	9.9	-
300		Tez Johnson (TB)	WR108	280	340	294	20.7	-
301		Noah Gray (KC)	TE39	273	299	285.4	9.9	-
302		Jacoby Brissett (ARI)	QB32	275	307	292	13.1	-
303		Jordan James (SF)	RB88	227	382	298.8	50.2	-
304		Jerome Ford (CLE)	RB89	282	294	286.8	5.5	-
305		Darren Waller (MIA)	TE40	228	294	265	27.5	-
306		Aaron Rodgers (PIT)	QB33	241	347	286	38.6	-
307		Antonio Williams (FA)	WR109	220	258	239	19	-
308		Elijah Arroyo (SEA)	TE41	260	305	280	18	-
309		Dont'e Thornton Jr. (LV)	WR110	276	302	288.2	8.3	-
310		Malik Washington (MIA)	WR111	287	339	296.8	18.9	-
311		Chris Bell (FA)	WR112	165	384	274.5	109.5	-
312		Jaylin Lane (WAS)	WR113	288	346	299	21.1	-
313		Kareem Hunt (KC)	RB90	277	357	299.8	29.8	-
314		Justice Hill (BAL)	RB91	283	316	294	11.6	-
315		Indianapolis Colts (IND)	DST20	279	318	294.4	18.9	-
316		Emari Demercado (ARI)	RB92	286	331	296.8	17.4	-
317		Tyler Higbee (LAR)	TE42	255	362	292.3	49.3	-
318		Demond Claiborne (FA)	RB93	257	259	258	1	-
319		Will Reichard (MIN)	K18	206	312	259	53	-
320		Samaje Perine (CIN)	RB94	291	337	302.7	15.7	-
321		LeQuint Allen Jr. (JAC)	RB95	290	312	296	8.3	-
322		Tahj Brooks (CIN)	RB96	286	342	304.2	17.6	-
323		John Bates (WAS)	TE43	267	351	299.5	31.2	-
324		Darnell Washington (PIT)	TE44	258	344	291	37.9	-
325		Xavier Hutchinson (HOU)	WR114	292	372	309.8	31.2	-
326		Jalen Royals (KC)	WR115	298	311	303	4.4	-
327		Joshua Palmer (BUF)	WR116	293	370	309.6	30.2	-
328		Olamide Zaccheaus (CHI)	WR117	297	345	307.7	16.8	-
329		Jalen Nailor (MIN)	WR118	295	375	311.8	31.6	-
330		Tua Tagovailoa (MIA)	QB34	294	320	304.7	7.7	-
331		John Metchie III (NYJ)	WR119	297	343	307.2	17.9	-
332		Nick Chubb (HOU)	RB97	293	353	309.6	22.1	-
333		DeMario Douglas (NE)	WR120	296	373	313.6	29.8	-
334		Michael Mayer (LV)	TE45	280	308	293.3	11.5	-
335		Miami Dolphins (MIA)	DST21	270	355	311.2	27.5	-
336		Chris Brooks (GB)	RB98	304	317	307	5.1	-
337		Greg Dulcich (MIA)	TE46	260	335	297.5	37.5	-
338		Michael Carter (ARI)	RB99	305	336	312.4	11.9	-
339		Zane Gonzalez (ATL)	K19	296	332	313.8	10.9	-
340		Anthony Richardson Sr. (IND)	QB35	306	323	311.8	5.8	-
341		Terrell Jennings (NE)	RB100	304	388	327	35.3	-
342		Dameon Pierce (KC)	RB101	306	386	326.8	34.2	-
343		Joe Milton III (DAL)	QB36	310	367	322.6	22.2	-
344		Antonio Gibson (NE)	RB102	308	391	329.3	35.7	-
345		Jawhar Jordan (HOU)	RB103	307	321	313.8	4.5	-
346		Austin Ekeler (WAS)	RB104	308	363	322.2	20.5	-
347		Geno Smith (LV)	QB37	308	358	321.2	16.9	-
348		Raheim Sanders (CLE)	RB105	310	364	324.3	23	-
349		Will Shipley (PHI)	RB106	309	359	322.6	18.4	-
350		Tyrod Taylor (NYJ)	QB38	304	312	308	4	-
351		Ty Simpson (FA)	QB39	299	334	316.5	17.5	-
352		Marcus Mariota (WAS)	QB40	309	394	351.5	42.5	-"""

ALIASES = {
    "Patrick Mahomes II": "Patrick Mahomes",
    "Deebo Samuel Sr.": "Deebo Samuel",
    "Aaron Jones Sr.": "Aaron Jones",
    "Anthony Richardson Sr.": "Anthony Richardson",
    "Chris Godwin Jr.": "Chris Godwin",
    "Brian Thomas Jr.": "Brian Thomas",
    "Kyle Pitts Sr.": "Kyle Pitts",
    "Michael Pittman Jr.": "Michael Pittman",
    "Marvin Harrison Jr.": "Marvin Harrison",
    "Ollie Gordon II": "Ollie Gordon",
    "Chris Rodriguez Jr.": "Chris Rodriguez",
    "Jonathon Brooks": "Jonathan Brooks",
    "Travis Etienne Jr.": "Travis Etienne",
    "Michael Penix Jr.": "Michael Penix",
    "Thomas Fidone II": "Thomas Fidone",
    "Erick All Jr.": "Erick All",
}


def extract_name(raw: str) -> str:
    raw = raw.strip()
    m = re.match(r"^(.+?)\s*\((?:FA|[A-Z]{2,3})\)\s*$", raw)
    if m:
        return m.group(1).strip()
    return raw


def extract_position(pos_col: str) -> str:
    pos_col = pos_col.strip().upper()
    if pos_col.startswith("DST"):
        return "D/ST"
    if len(pos_col) >= 2 and pos_col[:2] in ("QB", "RB", "WR", "TE"):
        return pos_col[:2]
    return pos_col[:1] if pos_col else ""


def parse() -> list[tuple[int, str, str, float, bool]]:
    """Parse tab-separated. Col 2=name, 3=POS, 6=AVG (no AGE col in standard/season format)."""
    lines = RAW.strip().split("\n")
    rows = []
    for line in lines:
        line = line.strip()
        if not line or "RK" in line or "Tier" in line or "Customize" in line:
            continue
        parts = line.split("\t")
        if len(parts) < 7:
            continue
        try:
            rk = int(parts[0].strip())
        except ValueError:
            continue
        name_raw = parts[2].strip()
        name = extract_name(name_raw)
        if not name:
            continue
        pos = extract_position(parts[3])
        try:
            avg = float(parts[6].strip())
        except (ValueError, IndexError):
            avg = float(rk)
        is_fa = "(FA)" in name_raw
        rows.append((rk, name, pos, avg, is_fa))
    return rows


def esc(s: str) -> str:
    return s.replace("'", "''")


def generate_migration() -> str:
    rows = parse()
    values_lines = [
        f"    ('{esc(name)}', '{pos}', {avg}::numeric, {str(is_fa).lower()})"
        for _, name, pos, avg, is_fa in rows
    ]
    values_sql = ",\n".join(values_lines)
    alias_lines = [f"    ('{esc(k)}', '{esc(v)}')" for k, v in ALIASES.items()]
    alias_sql = ",\n".join(alias_lines)

    return f"""-- Standard / season / non-superflex baseline rankings
-- Overrides existing baseline for this bucket (scoring_format=standard, league_type=season, is_superflex=false)
-- Inserts into baseline_community_rankings (matches players by name, season=2025)
-- Adds FA rookies to baseline_rookies if not in players or already in baseline_rookies

-- Delete existing baseline for this bucket so we fully replace
DELETE FROM public.baseline_community_rankings
WHERE scoring_format = 'standard' AND league_type = 'season' AND is_superflex = false;

DELETE FROM public.baseline_rookies
WHERE scoring_format = 'standard' AND league_type = 'season' AND is_superflex = false;

WITH parsed (input_name, position, avg_rank, is_fa) AS (
  VALUES
{values_sql}
),
aliases (input_name, db_name) AS (
  VALUES
{alias_sql}
),
lookup AS (
  SELECT
    p.input_name,
    p.position,
    p.avg_rank,
    p.is_fa,
    COALESCE(a.db_name, p.input_name) AS match_name
  FROM parsed p
  LEFT JOIN aliases a ON a.input_name = p.input_name
),
lookup_dedup AS (
  SELECT DISTINCT ON (match_name) input_name, position, avg_rank, is_fa, match_name
  FROM lookup
  ORDER BY match_name, avg_rank ASC
),

ins_baseline AS (
  INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank)
  SELECT
    'standard'::text,
    'season'::text,
    false,
    pl.id,
    l.avg_rank
  FROM lookup_dedup l
  INNER JOIN public.players pl ON pl.name = l.match_name AND pl.season = 2025
  ON CONFLICT (scoring_format, league_type, is_superflex, player_id)
  DO UPDATE SET rank = EXCLUDED.rank
)

INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT l.input_name, l.position, l.avg_rank, 'standard'::text, 'season'::text, false
FROM lookup_dedup l
WHERE l.is_fa = true
  AND NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE (p.name = l.match_name OR p.name = l.input_name) AND p.season = 2025
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.baseline_rookies br
    WHERE br.name = l.input_name
      AND br.scoring_format = 'standard'
      AND br.league_type = 'season'
      AND br.is_superflex = false
  )
ON CONFLICT (scoring_format, league_type, is_superflex, name) DO NOTHING;
"""


def main():
    rows = parse()
    fa_count = sum(1 for r in rows if r[4])
    if len(sys.argv) > 1 and sys.argv[1] == "--migration":
        out = generate_migration()
        out_path = "supabase/migrations/20260219240000_standard_season_non_sf_baseline.sql"
        with open(out_path, "w") as f:
            f.write(out)
        print(f"Wrote migration to {out_path}")
        print(f"Parsed {len(rows)} rows, {fa_count} FA players")
    else:
        print("-- Standard/season/non-superflex baseline: parsed", len(rows), "rows, FA:", fa_count)
        print("Run with --migration to generate migration file")


if __name__ == "__main__":
    main()
