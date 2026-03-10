#!/usr/bin/env python3
"""
Parse standard/season/superflex baseline rankings and output SQL for migration.
Format: RK, WSID, Player Name, POS, BEST, WORST, AVG (index 6) - no AGE column.
FA players -> baseline_rookies for standard/season/superflex if not in players.
Bucket: scoring_format=standard, league_type=season, is_superflex=true
"""

import re
import sys

# Raw data: tab-separated. Cols: RK, WSID, Player Name, POS, BEST, WORST, AVG (index 6), STD.DEV, ECR
RAW = """1		Josh Allen (BUF)	QB1	1	2	1.2	0.4	-
2		Lamar Jackson (BAL)	QB2	2	3	2.8	0.4	-
3		Drake Maye (NE)	QB3	2	6	3.2	1.5	-
4		Joe Burrow (CIN)	QB4	3	5	4	0.6	-
5		Bijan Robinson (ATL)	RB1	7	7	7	0	-
6		Jalen Hurts (PHI)	QB5	5	16	7.5	3.8	-
7		Jayden Daniels (WAS)	QB6	5	16	7.5	4.1	-
8		Puka Nacua (LAR)	WR1	10	10	10	0	-
9		Jahmyr Gibbs (DET)	RB2	11	11	11	0	-
10		Justin Herbert (LAC)	QB7	8	19	11.8	4.4	-
11		Ja'Marr Chase (CIN)	WR2	12	14	12.7	0.9	-
12		Jaxson Dart (NYG)	QB8	8	29	13	7.9	-
13		Jaxon Smith-Njigba (SEA)	WR3	12	14	13	1	-
14		Trevor Lawrence (JAC)	QB9	9	18	14.7	4	-
15		Jonathan Taylor (IND)	RB3	13	20	16.5	3.5	-
16		Christian McCaffrey (SF)	RB4	13	24	18.3	4	-
17		CeeDee Lamb (DAL)	WR4	15	22	19.2	3	-
18		Amon-Ra St. Brown (DET)	WR5	15	22	19.2	3	-
19		Patrick Mahomes II (KC)	QB10	16	26	19.3	3.1	-
20		Dak Prescott (DAL)	QB11	17	26	19.5	3	-
21		Caleb Williams (CHI)	QB12	9	26	19.8	6.6	-
22		Malik Nabers (NYG)	WR6	15	23	20.2	3.7	-
23		Brock Purdy (SF)	QB13	17	26	20.8	3.7	-
24		James Cook III (BUF)	RB5	13	25	21.8	4.3	-
25		De'Von Achane (MIA)	RB6	13	25	22.5	4.3	-
26		Drake London (ATL)	WR7	15	34	23	5.6	-
27		Nico Collins (HOU)	WR8	22	34	26.7	3.9	-
28		Ashton Jeanty (LV)	RB7	24	36	30.3	4	-
29		George Pickens (DAL)	WR9	23	35	31.5	4.8	-
30		Bo Nix (DEN)	QB14	29	38	31.8	3	-
31		Matthew Stafford (LAR)	QB15	29	41	32.8	4.8	-
32		Rashee Rice (KC)	WR10	27	43	33.3	5.4	-
33		Brock Bowers (LV)	TE1	31	39	35	4	-
34		Justin Jefferson (MIN)	WR11	27	43	35.8	4.8	-
35		Derrick Henry (BAL)	RB8	33	40	35.8	2.4	-
36		Saquon Barkley (PHI)	RB9	28	44	37	6.3	-
37		Omarion Hampton (LAC)	RB10	25	45	37.2	6.9	-
38		Jared Goff (DET)	QB16	32	50	38.5	6.1	-
39		Jordan Love (GB)	QB17	29	55	39	10.1	-
40		Chris Olave (NO)	WR12	35	53	41	6	-
41		Tee Higgins (CIN)	WR13	42	43	42.5	0.5	-
42		Josh Jacobs (GB)	RB11	36	52	42.8	5	-
43		Chase Brown (CIN)	RB12	33	52	44.2	6.2	-
44		Baker Mayfield (TB)	QB18	38	56	44.5	6.3	-
45		Tetairoa McMillan (CAR)	WR14	37	53	45	6.2	-
46		Trey McBride (ARI)	TE2	31	77	46.3	21.7	-
47		Tucker Kraft (GB)	TE3	39	57	47	6.3	-
48		A.J. Brown (PHI)	WR15	42	54	47.2	3.5	-
49		Breece Hall (NYJ)	RB13	40	57	48.7	6.3	-
50		Davante Adams (LAR)	WR16	46	54	50	2.7	-
51		Bucky Irving (TB)	RB14	45	63	54.3	5.6	-
52		Garrett Wilson (NYJ)	WR17	43	62	54.8	6.5	-
53		Kenneth Walker III (SEA)	RB15	48	69	55.5	8.3	-
54		Kyren Williams (LAR)	RB16	48	59	55.7	4.2	-
55		Malik Willis (GB)	QB19	32	83	56.2	15	-
56		Tyler Shough (NO)	QB20	55	66	57.2	4	-
57		Jameson Williams (DET)	WR18	53	65	57.3	4.8	-
58		Colston Loveland (CHI)	TE4	49	77	57.8	12.5	-
59		Sam Darnold (SEA)	QB21	60	76	64	5.7	-
60		Jaylen Waddle (MIA)	WR19	58	68	64.5	3.8	-
61		Zay Flowers (BAL)	WR20	51	71	64.7	6.9	-
62		Ladd McConkey (LAC)	WR21	54	72	64.8	7.2	-
63		Kyler Murray (ARI)	QB22	50	83	66.2	9.7	-
64		TreVeyon Henderson (NE)	RB17	50	75	66.2	8.8	-
65		Cam Ward (TEN)	QB23	60	76	67	5	-
66		Christian Watson (GB)	WR22	58	74	67.3	5.8	-
67		Travis Etienne Jr. (JAC)	RB18	59	75	67.3	6.2	-
68		Terry McLaurin (WAS)	WR23	61	81	67.3	7	-
69		Javonte Williams (DAL)	RB19	58	73	67.7	5.8	-
70		Cam Skattebo (NYG)	RB20	57	75	69.2	6.3	-
71		RJ Harvey (DEN)	RB21	63	75	69.7	4.3	-
72		C.J. Stroud (HOU)	QB24	50	134	70.5	28.7	-
73		Mike Evans (TB)	WR24	62	85	74.7	8.2	-
74		Luther Burden III (CHI)	WR25	65	85	75.5	6.4	-
75		Emeka Egbuka (TB)	WR26	54	89	76.7	11.4	-
76		Quinshon Judkins (CLE)	RB22	69	80	76.8	3.9	-
77		D'Andre Swift (CHI)	RB23	69	82	77.3	4.1	-
78		Courtland Sutton (DEN)	WR27	72	94	77.8	7.8	-
79		DeVonta Smith (PHI)	WR28	68	89	78.5	7.7	-
80		Rome Odunze (CHI)	WR29	54	90	79.7	13	-
81		Jaylen Warren (PIT)	RB24	80	91	83.8	3.5	-
82		DK Metcalf (PIT)	WR30	79	93	87	5.9	-
83		Harold Fannin Jr. (CLE)	TE5	77	96	88	6.8	-
84		Blake Corum (LAR)	RB25	84	98	89	5	-
85		Bryce Young (CAR)	QB25	70	160	90	31.5	-
86		Kyle Monangai (CHI)	RB26	86	97	90.7	3.8	-
87		Tyler Warren (IND)	TE6	88	96	91	3.6	-
88		Denzel Boston (FA)	WR31	81	107	91.8	9.5	-
89		Brian Thomas Jr. (JAC)	WR32	79	106	94.5	9.5	-
90		Rhamondre Stevenson (NE)	RB27	84	106	94.7	10	-
91		Bhayshul Tuten (JAC)	RB28	85	104	95.5	7.1	-
92		Michael Penix Jr. (ATL)	QB26	83	159	98.7	27.2	-
93		Rico Dowdle (CAR)	RB29	92	105	98.8	5.5	-
94		Marvin Harrison Jr. (ARI)	WR33	93	107	99.3	5.1	-
95		Tony Pollard (TEN)	RB30	92	107	99.5	4.5	-
96		Alec Pierce (IND)	WR34	95	111	101.7	6.3	-
97		Sam LaPorta (DET)	TE7	97	105	102.2	2.5	-
98		Daniel Jones (IND)	QB27	66	163	102.3	31.1	-
99		Michael Wilson (ARI)	WR35	100	108	103	3.6	-
100		Zach Charbonnet (SEA)	RB31	78	162	104.3	31.4	-
101		Jacory Croskey-Merritt (WAS)	RB32	93	115	104.3	7.1	-
102		Carnell Tate (FA)	WR36	46	175	105.5	55	-
103		Jordan Addison (MIN)	WR37	100	111	105.7	4.4	-
104		Kyle Pitts Sr. (ATL)	TE8	99	114	107.7	5.2	-
105		Woody Marks (HOU)	RB33	97	117	108.2	8.1	-
106		Brandon Aiyuk (SF)	WR38	94	132	108.8	13.9	-
107		Dalton Kincaid (BUF)	TE9	103	114	108.8	4.6	-
108		Jordyn Tyson (FA)	WR39	51	167	109.5	51.7	-
109		Ricky Pearsall (SF)	WR40	95	121	110.7	9.2	-
110		Quentin Johnston (LAC)	WR41	98	128	112	8.9	-
111		Chris Godwin Jr. (TB)	WR42	107	123	112.2	5.9	-
112		Jakobi Meyers (JAC)	WR43	108	121	112.5	4.5	-
113		Oronde Gadsden II (LAC)	TE10	108	120	114.3	4.4	-
114		K.C. Concepcion (FA)	WR44	89	154	114.5	26.4	-
115		Chuba Hubbard (CAR)	RB34	95	126	114.8	11.5	-
116		David Montgomery (DET)	RB35	113	122	115.7	3.8	-
117		Stefon Diggs (NE)	WR45	108	126	116	7.3	-
118		James Conner (ARI)	RB36	110	124	117.5	5.8	-
119		Makai Lemon (FA)	WR46	58	181	118.8	49.4	-
120		Aaron Jones Sr. (MIN)	RB37	116	123	119.2	3.2	-
121		Michael Pittman Jr. (IND)	WR47	108	127	120.8	6	-
122		J.J. McCarthy (MIN)	QB28	70	161	89.4	35.9	-
123		Tyler Allgeier (ATL)	RB38	106	128	122	7.6	-
124		Jauan Jennings (SF)	WR48	115	128	122.2	4.9	-
125		Braelon Allen (NYJ)	RB39	119	132	122.8	4.8	-
126		Brenton Strange (JAC)	TE11	112	136	124.2	9.9	-
127		Parker Washington (JAC)	WR49	100	139	125	13.2	-
128		Jeremiyah Love (FA)	RB40	28	226	125.3	91.9	-
129		DJ Moore (CHI)	WR50	117	143	126.3	8.3	-
130		Jake Ferguson (DAL)	TE12	120	155	128.7	11.9	-
131		Juwan Johnson (NO)	TE13	124	142	131.7	7.9	-
132		Jayden Higgins (HOU)	WR51	115	158	133.5	13.8	-
133		J.K. Dobbins (DEN)	RB41	131	144	133.7	4.7	-
134		Shedeur Sanders (CLE)	QB29	87	162	106.2	28	-
135		Dallas Goedert (PHI)	TE14	125	147	135.5	8.2	-
136		Wan'Dale Robinson (NYG)	WR52	130	142	135.7	3.5	-
137		George Kittle (SF)	TE15	105	174	136.7	21.9	-
138		Jordan Mason (MIN)	RB42	131	147	137	5.5	-
139		Alvin Kamara (NO)	RB43	134	143	138.5	2.9	-
140		Tyrone Tracy Jr. (NYG)	RB44	134	148	139.7	4.3	-
141		Tyreek Hill (FA)	WR53	130	170	141.2	13.6	-
142		Trey Benson (ARI)	RB45	127	150	141.8	7.4	-
143		Khalil Shakir (BUF)	WR54	133	149	142	5.3	-
144		Hunter Henry (NE)	TE16	136	154	142.2	6.5	-
145		Kaleb Johnson (PIT)	RB46	138	155	144.3	5.9	-
146		Xavier Worthy (KC)	WR55	141	151	146	3.1	-
147		Deebo Samuel Sr. (WAS)	WR56	137	173	147	12.2	-
148		Jayden Reed (GB)	WR57	135	169	148.5	13.8	-
149		Travis Hunter (JAC)	WR58	129	191	148.7	20.8	-
150		Tank Bigsby (PHI)	RB47	143	161	150.5	7.2	-
151		Dylan Sampson (CLE)	RB48	151	155	152	1.5	-
152		Kenneth Gainwell (PIT)	RB49	144	159	152.3	4.9	-
153		Josh Downs (IND)	WR59	138	172	152.7	10.2	-
154		Jalen Coker (CAR)	WR60	141	173	154	9.9	-
155		Troy Franklin (DEN)	WR61	146	176	156.7	11.8	-
156		Mark Andrews (BAL)	TE17	154	164	159.7	3.3	-
157		Jacoby Brissett (ARI)	QB30	118	165	136	17.4	-
158		Kimani Vidal (LAC)	RB50	153	173	160.8	6.5	-
159		Joe Mixon (HOU)	RB51	150	199	161.8	17.5	-
160		Adonai Mitchell (NYJ)	WR62	156	175	161.8	6.8	-
161		Tyjae Spears (TEN)	RB52	157	166	162.8	2.9	-
162		Dalton Schultz (HOU)	TE18	154	174	163.7	5.9	-
163		Rachaad White (TB)	RB53	157	183	164.3	9.6	-
164		Isiah Pacheco (KC)	RB54	155	180	165.7	9.4	-
165		Tua Tagovailoa (MIA)	QB31	117	176	142.6	18.9	-
166		Keaton Mitchell (BAL)	RB55	158	178	165.8	6.2	-
167		Brian Robinson Jr. (SF)	RB56	162	177	167.3	4.7	-
168		Mac Jones (SF)	QB32	127	180	145	22.6	-
169		Kayshon Boutte (NE)	WR63	164	172	167.8	2.5	-
170		Travis Kelce (KC)	TE19	145	189	168	15.3	-
171		Jonathon Brooks (CAR)	RB57	134	184	169.8	17	-
172		Jerry Jeudy (CLE)	WR64	160	179	170.8	6	-
173		Romeo Doubs (GB)	WR65	152	180	172	9.6	-
174		Terrance Ferguson (LAR)	TE20	133	188	172.7	19.4	-
175		Tank Dell (HOU)	WR66	163	181	173.3	6.9	-
176		Kendre Miller (NO)	RB58	162	202	174	13.6	-
177		Jaylen Wright (MIA)	RB59	168	184	174	5.1	-
178		Chimere Dike (TEN)	WR67	170	181	174.3	3.9	-
179		Rashid Shaheed (SEA)	WR68	169	186	174.5	5.4	-
180		Sean Tucker (TB)	RB60	159	184	175.5	8.7	-
181		Chris Rodriguez Jr. (WAS)	RB61	166	208	178.8	16.8	-
182		Devin Neal (NO)	RB62	162	190	179.7	9.2	-
183		Isaiah Likely (BAL)	TE21	156	200	180.5	14.1	-
184		Theo Johnson (NYG)	TE22	174	189	181.2	4.8	-
185		Elic Ayomanor (TEN)	WR69	175	188	181.2	4.5	-
186		Isaac TeSlaa (DET)	WR70	172	208	182.5	11.7	-
187		Jaylin Noel (HOU)	WR71	171	192	185.5	7	-
188		Matthew Golden (GB)	WR72	182	192	187	4	-
189		Jadarian Price (FA)	RB63	80	103	94	10	-
190		Fernando Mendoza (FA)	QB33	64	158	96	43.9	-
191		Kyle Williams (NE)	WR73	180	202	189.2	7.1	-
192		Emanuel Wilson (GB)	RB64	179	206	190	8.2	-
193		AJ Barner (SEA)	TE23	182	194	191.3	4.3	-
194		Tre Harris (LAC)	WR74	183	205	191.8	6.7	-
195		Tre Tucker (LV)	WR75	192	199	194.3	2.4	-
196		Emmett Johnson (FA)	RB65	86	146	109.7	26.1	-
197		Tory Horton (SEA)	WR76	195	200	196.5	1.6	-
198		Ryan Flournoy (DAL)	WR77	195	204	197.5	3.2	-
199		Ray Davis (BUF)	RB66	190	217	197.7	9.7	-
200		Geno Smith (LV)	QB34	174	185	182.6	4.3	-
201		Pat Bryant (DEN)	WR78	192	203	199.2	3.4	-
202		Jonah Coleman (FA)	RB67	100	146	119.7	19.4	-
203		Isaiah Davis (NYJ)	RB68	157	216	201.8	20.5	-
204		Darnell Mooney (ATL)	WR79	195	214	203.2	6	-
205		T.J. Hockenson (MIN)	TE24	197	216	203.7	8.4	-
206		Rashod Bateman (BAL)	WR80	199	219	204.8	6.8	-
207		Keon Coleman (BUF)	WR81	199	211	205.2	5.2	-
208		Jalen McMillan (TB)	WR82	194	218	206	7.5	-
209		Calvin Ridley (TEN)	WR83	192	221	206.5	10.8	-
210		Ollie Gordon II (MIA)	RB69	201	219	207	6.9	-
211		Mack Hollins (NE)	WR84	205	216	210.3	4.7	-
212		Najee Harris (LAC)	RB70	186	232	210.7	13.5	-
213		Jaleel McLaughlin (DEN)	RB71	202	223	211.3	8.6	-
214		David Njoku (CLE)	TE25	206	224	211.5	6.3	-
215		Marvin Mims Jr. (DEN)	WR85	208	221	211.5	4.4	-
216		Anthony Richardson Sr. (IND)	QB35	177	182	178.3	2.2	-
217		Xavier Legette (CAR)	WR86	208	218	213.2	4.3	-
218		Colby Parkinson (LAR)	TE26	207	223	214.7	6.4	-
219		Mason Taylor (NYJ)	TE27	204	228	214.8	8.2	-
220		Dontayvion Wicks (GB)	WR87	211	221	215.3	4.1	-
221		Kenyon Sadiq (FA)	TE28	118	212	149.3	44.3	-
222		Isaac Guerendo (SF)	RB72	197	227	205.8	11.9	-
223		Gunnar Helm (TEN)	TE29	215	227	222.2	4.6	-
224		Darius Slayton (NYG)	WR88	218	235	222.2	6.1	-
225		Ty Johnson (BUF)	RB73	216	240	222.5	8.3	-
226		Aaron Rodgers (PIT)	QB36	87	126	106.5	19.5	-
227		Chig Okonkwo (TEN)	TE30	220	229	226.2	2.9	-
228		Pat Freiermuth (PIT)	TE31	219	230	226.5	3.5	-
229		Isaiah Bond (CLE)	WR89	217	260	227	15	-
230		Cooper Kupp (SEA)	WR90	221	245	227	8.6	-
231		Brashard Smith (KC)	RB74	212	243	227.5	11.2	-
232		Keenan Allen (LAC)	WR91	212	239	227.7	9.7	-
233		DJ Giddens (IND)	RB75	219	265	229	16.3	-
234		Joe Milton III (DAL)	QB37	183	183	183	0	-
235		Omar Cooper Jr. (FA)	WR92	121	147	134	13	-
236		Malik Davis (DAL)	RB76	214	258	224.2	17	-
237		Jaydon Blue (DAL)	RB77	197	273	234.3	26.3	-
238		Eli Stowers (FA)	TE32	160	220	188.7	24.6	-
239		Malachi Fields (FA)	WR93	143	160	151.5	8.5	-
240		Jake Tonges (SF)	TE33	203	247	230.2	16.4	-
241		Chris Brazzell II (FA)	WR94	120	190	155	35	-
242		Konata Mumpfield (LAR)	WR95	231	254	240.2	7.1	-
243		Kaytron Allen (FA)	RB78	131	185	158	27	-
244		Mike Washington Jr. (FA)	RB79	150	166	158	8	-
245		Luke McCaffrey (WAS)	WR96	237	257	241.7	7	-
246		Andrei Iosivas (CIN)	WR97	224	253	234.4	10.6	-
247		George Holani (SEA)	RB80	197	287	243.2	26	-
248		Devaughn Vele (NO)	WR98	222	269	243	13.7	-
249		Cade Otton (TB)	TE34	237	250	243	4.4	-
250		Evan Engram (DEN)	TE35	233	255	243.3	8.1	-
251		Bam Knight (ARI)	RB81	225	261	236.4	12.7	-
252		Jarquez Hunter (LAR)	RB82	226	273	236.8	18.2	-
253		Audric Estime (NO)	RB83	232	251	237.4	7.1	-
254		Jack Bech (LV)	WR99	241	266	246.2	8.9	-
255		MarShawn Lloyd (GB)	RB84	230	268	239.2	14.5	-
256		Elijah Sarratt (FA)	WR100	163	197	180	17	-
257		Tyquan Thornton (KC)	WR101	234	263	241.2	10.9	-
258		Marquise Brown (KC)	WR102	244	271	249.2	9.8	-
259		Nicholas Singleton (FA)	RB85	175	194	184.5	9.5	-
260		Germie Bernard (FA)	WR103	180	192	186	6	-
261		Calvin Austin III (PIT)	WR104	237	262	243.8	9.2	-
262		Tommy Myers (FA)	TE36	198	229	218.7	14.6	-
263		Zachariah Branch (FA)	WR105	183	193	188	5	-
264		Ben Sinnott (WAS)	TE37	207	306	241.5	38.1	-
265		Devin Singletary (NYG)	RB86	238	274	246	14.1	-
266		Christian Kirk (HOU)	WR106	244	255	247.4	4	-
267		Mike Gesicki (CIN)	TE38	239	264	249.2	11.3	-
268		Cedric Tillman (CLE)	WR107	245	278	254.8	10.8	-
269		Noah Gray (KC)	TE39	243	267	251.6	8.1	-
270		Elijah Arroyo (SEA)	TE40	230	270	244.5	15.8	-
271		Tez Johnson (TB)	WR108	248	299	260.3	17.4	-
272		Antonio Williams (FA)	WR109	191	228	209.5	18.5	-
273		Trevor Etienne (CAR)	RB87	247	277	254	11.6	-
274		Jerome Ford (CLE)	RB88	249	261	254.8	5.2	-
275		Darren Waller (MIA)	TE41	210	259	238.3	20.7	-
276		Dont'e Thornton Jr. (LV)	WR110	248	267	256.2	6.1	-
277		Malik Washington (MIA)	WR111	255	298	263.2	15.6	-
278		Jordan James (SF)	RB89	208	337	267.2	41.8	-
279		Jaylin Lane (WAS)	WR112	256	305	265.3	17.8	-
280		Chris Bell (FA)	WR113	161	339	250	89	-
281		Demond Claiborne (FA)	RB90	218	229	223.5	5.5	-
282		Tyler Higbee (LAR)	TE42	222	318	257.3	43.1	-
283		Kareem Hunt (KC)	RB91	249	314	266.6	24.8	-
284		Darnell Washington (PIT)	TE43	225	303	253.3	35.2	-
285		Emari Demercado (ARI)	RB92	253	293	263.4	15.2	-
286		Justice Hill (BAL)	RB93	252	280	261.4	9.9	-
287		LeQuint Allen Jr. (JAC)	RB94	258	276	263.2	6.7	-
288		Samaje Perine (CIN)	RB95	259	297	269.2	12.8	-
289		John Bates (WAS)	TE44	240	309	266.3	25.8	-
290		Tahj Brooks (CIN)	RB96	254	301	270.5	14.4	-
291		Xavier Hutchinson (HOU)	WR114	260	327	275	26.1	-
292		Joshua Palmer (BUF)	WR115	261	325	274.8	25.1	-
293		Michael Mayer (LV)	TE45	247	272	256.3	11.2	-
294		Jalen Nailor (MIN)	WR116	263	330	277	26.5	-
295		Jalen Royals (KC)	WR117	266	275	270	3.1	-
296		Olamide Zaccheaus (CHI)	WR118	265	304	274	13.5	-
297		John Metchie III (NYJ)	WR119	265	302	273.2	14.4	-
298		Nick Chubb (HOU)	RB97	261	311	275.4	18.2	-
299		DeMario Douglas (NE)	WR120	264	328	278.8	24.6	-
300		Greg Dulcich (MIA)	TE46	221	295	258	37	-
301		Adam Randall (FA)	RB98	223	223	223	0	-
302		Ja'Kobi Lane (FA)	WR121	231	231	231	0	-
303		Reggie Virgil (FA)	WR122	233	233	233	0	-
304		Ted Hurst (FA)	WR123	234	234	234	0	-
305		Le'Veon Moss (FA)	RB99	235	235	235	0	-
306		Chris Brooks (GB)	RB100	270	281	273.2	4	-
307		Jam Miller (FA)	RB101	246	246	246	0	-
308		Michael Carter (ARI)	RB102	271	296	277.8	9.3	-
309		Jared Wiley (KC)	TE47	249	249	249	0	-
310		J'Mari Taylor (FA)	RB103	256	256	256	0	-
311		Terrell Jennings (NE)	RB104	271	341	290.5	29.2	-
312		Dameon Pierce (KC)	RB105	273	340	290.5	28.6	-
313		Jawhar Jordan (HOU)	RB106	273	284	278.6	3.6	-
314		Austin Ekeler (WAS)	RB107	274	319	285.6	16.8	-
315		Antonio Gibson (NE)	RB108	275	344	292.8	29.6	-
316		Raheim Sanders (CLE)	RB109	276	320	287.8	18.6	-
317		Will Shipley (PHI)	RB110	275	315	286	14.6	-
318		Deion Burks (FA)	WR124	279	279	279	0	-
319		Caleb Douglas (FA)	WR125	282	282	282	0	-
320		Ja'Tavion Sanders (CAR)	TE48	283	283	283	0	-
321		Tyren Montgomery (FA)	WR126	285	285	285	0	-
322		Cole Kmet (CHI)	TE49	286	286	286	0	-
323		Seth McGowan (FA)	RB111	288	288	288	0	-
324		Skyler Bell (FA)	WR127	289	289	289	0	-
325		Jaydn Ott (FA)	RB112	290	290	290	0	-
326		Kaelon Black (FA)	RB113	291	291	291	0	-
327		Kevin Coleman Jr. (FA)	WR128	292	292	292	0	-
328		Barion Brown (FA)	WR129	294	294	294	0	-
329		Luke Musgrave (GB)	TE50	300	300	300	0	-
330		Bryce Lance (FA)	WR130	307	307	307	0	-
331		Josh Cameron (FA)	WR131	308	308	308	0	-
332		Max Klare (FA)	TE51	310	310	310	0	-
333		Dawson Knox (BUF)	TE52	312	312	312	0	-
334		Elijah Higgins (ARI)	TE53	313	313	313	0	-
335		Jonnu Smith (PIT)	TE54	316	316	316	0	-
336		Vinny Anthony II (FA)	WR132	317	317	317	0	-
337		Roman Hemby (FA)	RB114	321	321	321	0	-
338		Michael Trigg (FA)	TE55	322	322	322	0	-
339		Brenen Thompson (FA)	WR133	323	323	323	0	-
340		Robert Henry Jr. (FA)	RB115	324	324	324	0	-
341		Justin Joly (FA)	TE56	326	326	326	0	-
342		Jack Endries (FA)	TE57	329	329	329	0	-
343		Tanner Koziol (FA)	TE58	331	331	331	0	-
344		Aaron Anderson (FA)	WR134	332	332	332	0	-
345		C.J. Daniels (FA)	WR135	333	333	333	0	-
346		Dane Key (FA)	WR136	334	334	334	0	-
347		Desmond Reid (FA)	RB116	335	335	335	0	-
348		Zach Ertz (WAS)	TE59	336	336	336	0	-
349		Chris Hilton Jr. (FA)	WR137	338	338	338	0	-
350		Thomas Fidone II (NYG)	TE60	342	342	342	0	-
351		Taysom Hill (NO)	TE61	343	343	343	0	-
352		Jamal Haynes (FA)	RB117	345	345	345	0	-
353		Erick All Jr. (CIN)	TE62	346	346	346	0	-"""

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

    return f"""-- Standard / season / superflex baseline rankings
-- Overrides existing baseline for this bucket (scoring_format=standard, league_type=season, is_superflex=true)
-- Inserts into baseline_community_rankings (matches players by name, season=2025)
-- Adds FA rookies to baseline_rookies if not in players or already in baseline_rookies

-- Delete existing baseline for this bucket so we fully replace
DELETE FROM public.baseline_community_rankings
WHERE scoring_format = 'standard' AND league_type = 'season' AND is_superflex = true;

DELETE FROM public.baseline_rookies
WHERE scoring_format = 'standard' AND league_type = 'season' AND is_superflex = true;

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
    true,
    pl.id,
    l.avg_rank
  FROM lookup_dedup l
  INNER JOIN public.players pl ON pl.name = l.match_name AND pl.season = 2025
  ON CONFLICT (scoring_format, league_type, is_superflex, player_id)
  DO UPDATE SET rank = EXCLUDED.rank
)

INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT l.input_name, l.position, l.avg_rank, 'standard'::text, 'season'::text, true
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
      AND br.is_superflex = true
  )
ON CONFLICT (scoring_format, league_type, is_superflex, name) DO NOTHING;
"""


def main():
    rows = parse()
    fa_count = sum(1 for r in rows if r[4])
    if len(sys.argv) > 1 and sys.argv[1] == "--migration":
        out = generate_migration()
        out_path = "supabase/migrations/20260219250000_standard_season_superflex_baseline.sql"
        with open(out_path, "w") as f:
            f.write(out)
        print(f"Wrote migration to {out_path}")
        print(f"Parsed {len(rows)} rows, {fa_count} FA players")
    else:
        print("-- Standard/season/superflex baseline: parsed", len(rows), "rows, FA:", fa_count)
        print("Run with --migration to generate migration file")


if __name__ == "__main__":
    main()
