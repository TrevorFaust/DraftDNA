#!/usr/bin/env python3
"""
Parse PPR/season/superflex baseline rankings and output SQL for migration.
Input: tab-separated lines with RK, WSID, Player Name, POS, BEST, WORST, AVG (use column 7 = AVG).
FA players -> baseline_rookies for ppr/season/superflex if not in players.
"""

import re
import sys

# Raw data: one line per player, tabs. Cols: RK, WSID, Player Name, POS, BEST, WORST, AVG
RAW = """1		Josh Allen (BUF)	QB1	1	2	1.2	0.4	-
2		Lamar Jackson (BAL)	QB2	2	3	2.8	0.4	-
3		Drake Maye (NE)	QB3	2	7	3.3	1.8	-
4		Joe Burrow (CIN)	QB4	3	5	4	0.6	-
5		Jayden Daniels (WAS)	QB5	5	16	7.5	4.1	-
6		Ja'Marr Chase (CIN)	WR1	6	11	7.7	2.4	-
7		Jalen Hurts (PHI)	QB6	5	16	8.2	3.6	-
8		Puka Nacua (LAR)	WR2	6	11	8.5	2.5	-
9		Bijan Robinson (ATL)	RB1	10	10	10	0	-
10		Justin Herbert (LAC)	QB7	8	19	11.8	4.4	-
11		Jaxon Smith-Njigba (SEA)	WR3	12	12	12	0	-
12		Jaxson Dart (NYG)	QB8	8	29	13	7.9	-
13		Jahmyr Gibbs (DET)	RB2	13	13	13	0	-
14		Trevor Lawrence (JAC)	QB9	9	18	14.7	4	-
15		CeeDee Lamb (DAL)	WR4	14	20	15	2.2	-
16		Christian McCaffrey (SF)	RB3	15	22	16.2	2.6	-
17		Amon-Ra St. Brown (DET)	WR5	14	20	18	2.8	-
18		Patrick Mahomes II (KC)	QB10	16	26	19.3	3.1	-
19		Dak Prescott (DAL)	QB11	17	26	19.5	3	-
20		Caleb Williams (CHI)	QB12	9	26	19.8	6.6	-
21		Brock Purdy (SF)	QB13	17	26	20.8	3.7	-
22		De'Von Achane (MIA)	RB4	15	25	22.3	3.5	-
23		Drake London (ATL)	WR6	20	28	22.8	2.7	-
24		Justin Jefferson (MIN)	WR7	20	27	22.8	2.2	-
25		Malik Nabers (NYG)	WR8	21	24	23	1.4	-
26		Jonathan Taylor (IND)	RB5	22	25	23.5	1.5	-
27		Nico Collins (HOU)	WR9	23	28	26.3	2.4	-
28		Rashee Rice (KC)	WR10	23	34	27	3.5	-
29		Chris Olave (NO)	WR11	27	36	31.2	3.9	-
30		George Pickens (DAL)	WR12	24	35	31.7	4.2	-
31		Bo Nix (DEN)	QB14	29	38	31.8	3	-
32		James Cook III (BUF)	RB6	17	37	32.3	7.1	-
33		Ashton Jeanty (LV)	RB7	23	40	32.5	5	-
34		Matthew Stafford (LAR)	QB15	29	41	32.8	4.8	-
35		Trey McBride (ARI)	TE1	31	39	33.7	3.8	-
36		Brock Bowers (LV)	TE2	31	39	35	4	-
37		A.J. Brown (PHI)	WR13	35	43	37	2.7	-
38		Jared Goff (DET)	QB16	32	50	38.5	6.1	-
39		Jordan Love (GB)	QB17	29	55	39	10.1	-
40		Omarion Hampton (LAC)	RB8	33	42	39.2	2.9	-
41		Tetairoa McMillan (CAR)	WR14	35	44	40.5	3.9	-
42		Chase Brown (CIN)	RB9	37	43	40.5	2.5	-
43		Tee Higgins (CIN)	WR15	43	45	44.3	0.8	-
44		Baker Mayfield (TB)	QB18	38	56	44.5	6.3	-
45		Saquon Barkley (PHI)	RB10	40	49	44.8	3.6	-
46		Garrett Wilson (NYJ)	WR16	36	51	45.2	5.1	-
47		Josh Jacobs (GB)	RB11	42	58	48.2	5.4	-
48		Bucky Irving (TB)	RB12	46	54	48.7	2.5	-
49		Ladd McConkey (LAC)	WR17	43	62	53.8	6.3	-
50		Breece Hall (NYJ)	RB13	46	65	53.8	7	-
51		Davante Adams (LAR)	WR18	51	63	54.3	4.4	-
52		Zay Flowers (BAL)	WR19	42	68	54.5	7.8	-
53		Malik Willis (GB)	QB19	32	83	56.2	15	-
54		Derrick Henry (BAL)	RB14	49	65	56.8	5.2	-
55		Jameson Williams (DET)	WR20	52	62	56.8	4.3	-
56		Tyler Shough (NO)	QB20	55	66	57.2	4	-
57		DeVonta Smith (PHI)	WR21	51	69	60.2	7	-
58		Jaylen Waddle (MIA)	WR22	57	63	60.2	2.6	-
59		Luther Burden III (CHI)	WR23	54	69	62.7	5.3	-
60		Terry McLaurin (WAS)	WR24	52	69	63.2	6.1	-
61		Kenneth Walker III (SEA)	RB15	54	74	63.2	6.5	-
62		Sam Darnold (SEA)	QB21	60	76	64	5.7	-
63		Kyren Williams (LAR)	RB16	61	67	64.7	2.7	-
64		Mike Evans (TB)	WR25	57	72	65.5	6.1	-
65		Kyler Murray (ARI)	QB22	50	83	66.2	9.7	-
66		Harold Fannin Jr. (CLE)	TE3	47	93	66.8	20.8	-
67		Cam Ward (TEN)	QB23	60	76	67	5	-
68		RJ Harvey (DEN)	RB17	58	74	67.2	7.2	-
69		C.J. Stroud (HOU)	QB24	50	134	70.5	28.7	-
70		TreVeyon Henderson (NE)	RB18	55	79	70.8	9.3	-
71		Cam Skattebo (NYG)	RB19	59	77	71	6.3	-
72		Emeka Egbuka (TB)	WR26	57	80	71.3	8.6	-
73		Courtland Sutton (DEN)	WR27	68	75	72	2.5	-
74		Colston Loveland (CHI)	TE4	47	78	72.3	11.4	-
75		Javonte Williams (DAL)	RB20	62	79	72.7	6.8	-
76		Travis Etienne Jr. (JAC)	RB21	61	79	72.8	6.2	-
77		Christian Watson (GB)	WR28	67	89	77.2	8	-
78		Rome Odunze (CHI)	WR29	53	96	79.5	14.7	-
79		DK Metcalf (PIT)	WR30	73	90	80.3	5.6	-
80		Quinshon Judkins (CLE)	RB22	77	83	80.3	1.9	-
81		Brian Thomas Jr. (JAC)	WR31	72	95	82.3	6.9	-
82		D'Andre Swift (CHI)	RB23	74	88	83.5	4.9	-
83		Tucker Kraft (GB)	TE5	78	86	84	3.1	-
84		Tyler Warren (IND)	TE6	67	93	84.2	9.2	-
85		Jakobi Meyers (JAC)	WR32	73	102	84.2	8.8	-
86		Ricky Pearsall (SF)	WR33	73	96	86.3	7.6	-
87		Jaylen Warren (PIT)	RB24	85	92	88.7	2.6	-
88		Bryce Young (CAR)	QB25	70	166	91.2	33.7	-
89		Chris Godwin Jr. (TB)	WR34	84	100	92.3	5.8	-
90		Stefon Diggs (NE)	WR35	89	101	93.5	5.3	-
91		Rhamondre Stevenson (NE)	RB25	92	108	98.5	7.2	-
92		Kyle Monangai (CHI)	RB26	96	105	98.5	3	-
93		Rico Dowdle (CAR)	RB27	95	105	98.7	3.9	-
94		Marvin Harrison Jr. (ARI)	WR36	93	103	99.5	3.1	-
95		Michael Penix Jr. (ATL)	QB26	83	165	99.7	29.4	-
96		Michael Wilson (ARI)	WR37	92	107	100.3	4.5	-
97		Tony Pollard (TEN)	RB28	95	103	100.7	3.1	-
98		Sam LaPorta (DET)	TE7	93	104	101.5	4.1	-
99		Michael Pittman Jr. (IND)	WR38	98	107	102.5	3.1	-
100		Daniel Jones (IND)	QB27	66	169	103.5	33	-
101		Kyle Pitts Sr. (ATL)	TE8	98	113	106.5	5.3	-
102		Bhayshul Tuten (JAC)	RB29	90	130	108.2	13.8	-
103		James Conner (ARI)	RB30	99	122	109.2	7.3	-
104		Jordan Addison (MIN)	WR39	109	111	109.7	0.9	-
105		Blake Corum (LAR)	RB31	105	120	109.8	5.2	-
106		Chuba Hubbard (CAR)	RB32	89	131	113.2	15.6	-
107		Zach Charbonnet (SEA)	RB33	85	168	114.2	31.2	-
108		Wan'Dale Robinson (NYG)	WR40	110	123	114.2	4.5	-
109		Quentin Johnston (LAC)	WR41	91	129	114.5	11.7	-
110		Woody Marks (HOU)	RB34	99	134	114.5	12.3	-
111		Dalton Kincaid (BUF)	TE9	106	125	114.5	5.6	-
112		Aaron Jones Sr. (MIN)	RB35	105	132	115	12.2	-
113		Khalil Shakir (BUF)	WR42	112	125	116	4.4	-
114		Trey Benson (ARI)	RB36	104	130	116.2	8.8	-
115		Jauan Jennings (SF)	WR43	110	122	117.7	4.8	-
116		Alec Pierce (IND)	WR44	108	128	119.2	6.3	-
117		Alvin Kamara (NO)	RB37	116	130	119.7	5.3	-
118		Brenton Strange (JAC)	TE10	112	126	120.2	5.9	-
119		Jake Ferguson (DAL)	TE11	115	128	120.5	5.6	-
120		Oronde Gadsden II (LAC)	TE12	118	121	120.5	1.1	-
121		J.J. McCarthy (MIN)	QB28	70	167	90.6	38.3	-
122		Parker Washington (JAC)	WR45	96	135	122.5	13.9	-
123		Juwan Johnson (NO)	TE13	115	136	125	6.2	-
124		Travis Hunter (JAC)	WR46	101	160	125.5	20	-
125		Tyreek Hill (FA)	WR47	114	149	126.8	10.8	-
126		DJ Moore (CHI)	WR48	124	144	128.3	7.3	-
127		Jayden Higgins (HOU)	WR49	109	142	129.2	10.8	-
128		David Montgomery (DET)	RB38	120	141	129.3	6.3	-
129		Jacory Croskey-Merritt (WAS)	RB39	111	141	132.3	10.1	-
130		Xavier Worthy (KC)	WR50	125	137	133.2	3.9	-
131		Dylan Sampson (CLE)	RB40	131	141	133.7	3.4	-
132		Jayden Reed (GB)	WR51	129	147	136.3	7	-
133		Shedeur Sanders (CLE)	QB29	87	168	107.4	30.4	-
134		Braelon Allen (NYJ)	RB41	127	150	137.2	6.8	-
135		George Kittle (SF)	TE14	106	174	137.3	21.7	-
136		Josh Downs (IND)	WR52	132	149	137.8	5.3	-
137		Dalton Schultz (HOU)	TE15	133	142	137.8	3.3	-
138		Deebo Samuel Sr. (WAS)	WR53	132	163	138.8	11.1	-
139		Tyler Allgeier (ATL)	RB42	130	150	141.3	7.2	-
140		Kenneth Gainwell (PIT)	RB43	138	147	142.2	2.7	-
141		Jalen Coker (CAR)	WR54	124	158	143.3	10.4	-
142		Tyjae Spears (TEN)	RB44	141	153	146.3	4.3	-
143		Dallas Goedert (PHI)	TE16	142	153	147.2	3.5	-
144		Tyrone Tracy Jr. (NYG)	RB45	145	150	147.7	2.4	-
145		Jeremiyah Love (FA)	RB46	46	255	150.3	90.9	-
146		Adonai Mitchell (NYJ)	WR55	145	164	150.5	6.2	-
147		Jerry Jeudy (CLE)	WR56	144	161	150.7	6.7	-
148		Troy Franklin (DEN)	WR57	144	164	151	7.6	-
149		J.K. Dobbins (DEN)	RB47	143	154	151.5	3.9	-
150		Hunter Henry (NE)	TE17	138	164	152.7	8.5	-
151		K.C. Concepcion (FA)	WR58	83	212	154.8	49.5	-
152		Jordan Mason (MIN)	RB48	152	158	155.3	2.1	-
153		Kaleb Johnson (PIT)	RB49	150	165	156.7	4.6	-
154		Rachaad White (TB)	RB50	152	165	157.5	5.1	-
155		Carnell Tate (FA)	WR59	94	230	158.8	53.3	-
156		Rashid Shaheed (SEA)	WR60	151	170	160.7	6.3	-
157		Jacoby Brissett (ARI)	QB30	118	171	137.2	19.4	-
158		Travis Kelce (KC)	TE18	144	182	162.5	12.6	-
159		Chimere Dike (TEN)	WR61	151	173	162.7	7.6	-
160		Brandon Aiyuk (SF)	WR62	149	175	163.2	8.6	-
161		Jordyn Tyson (FA)	WR63	108	218	163.7	50.1	-
162		Devin Neal (NO)	RB51	160	172	165.2	3.6	-
163		Tua Tagovailoa (MIA)	QB31	117	177	142.8	19.3	-
164		Tre Harris (LAC)	WR64	147	185	166	13.4	-
165		Jaylin Noel (HOU)	WR65	160	180	167.2	8.1	-
166		Tank Bigsby (PHI)	RB52	162	176	167.2	6.1	-
167		Makai Lemon (FA)	WR66	104	234	167.3	47.3	-
168		Isiah Pacheco (KC)	RB53	157	182	167.3	9.4	-
169		Matthew Golden (GB)	WR67	162	170	167.5	3	-
170		Mark Andrews (BAL)	TE19	153	174	167.7	9	-
171		Isaiah Likely (BAL)	TE20	156	183	168	9.1	-
172		Mac Jones (SF)	QB32	127	181	146.4	24	-
173		Kimani Vidal (LAC)	RB54	163	190	169.7	9.3	-
174		Romeo Doubs (GB)	WR68	160	177	170.2	5.2	-
175		Elic Ayomanor (TEN)	WR69	169	179	172.3	3.6	-
176		Keaton Mitchell (BAL)	RB55	161	196	173.7	11.4	-
177		Kayshon Boutte (NE)	WR70	166	181	174.8	4.9	-
178		Pat Bryant (DEN)	WR71	170	186	176.7	5.8	-
179		Brian Robinson Jr. (SF)	RB56	172	187	179	4.5	-
180		Kendre Miller (NO)	RB57	166	205	180.5	13	-
181		Denzel Boston (FA)	WR72	82	167	131	31.3	-
182		Theo Johnson (NYG)	TE21	172	194	182.7	6.4	-
183		Isaiah Davis (NYJ)	RB58	150	207	182.8	17.6	-
184		Tre Tucker (LV)	WR73	175	194	183.8	6.8	-
185		Joe Mixon (HOU)	RB59	168	210	184	17.8	-
186		Darnell Mooney (ATL)	WR74	181	200	186.7	6.8	-
187		Ryan Flournoy (DAL)	WR75	180	195	187	6.8	-
188		Fernando Mendoza (FA)	QB33	64	162	97.3	45.7	-
189		Jalen McMillan (TB)	WR76	180	207	190.5	9.1	-
190		T.J. Hockenson (MIN)	TE22	188	197	191.5	3.9	-
191		AJ Barner (SEA)	TE23	182	206	194.3	7.2	-
192		Terrance Ferguson (LAR)	TE24	165	214	195	15.6	-
193		Jaylen Wright (MIA)	RB60	191	206	195	5.3	-
194		Emanuel Wilson (GB)	RB61	185	211	195.3	9.6	-
195		Keon Coleman (BUF)	WR77	188	205	196	6.9	-
196		Mack Hollins (NE)	WR78	188	207	196.3	7.3	-
197		Marvin Mims Jr. (DEN)	WR79	191	218	197.2	9.5	-
198		Isaac TeSlaa (DET)	WR80	193	202	197.3	3.9	-
199		Calvin Ridley (TEN)	WR81	188	212	197.8	8.9	-
200		Geno Smith (LV)	QB34	176	184	182.4	3.2	-
201		Jadarian Price (FA)	RB62	102	131	117.3	11.9	-
202		Jonathon Brooks (CAR)	RB63	156	220	200	21.9	-
203		Mason Taylor (NYJ)	TE25	193	206	200.3	5	-
204		Rashod Bateman (BAL)	WR82	194	216	201.3	7.2	-
205		Kyle Williams (NE)	WR83	196	209	201.8	4.8	-
206		Brashard Smith (KC)	RB64	172	229	202.7	19.2	-
207		Xavier Legette (CAR)	WR84	195	215	203	7.8	-
208		Emmett Johnson (FA)	RB65	110	140	125.7	12.3	-
209		Dontayvion Wicks (GB)	WR85	199	214	204	5.1	-
210		Sean Tucker (TB)	RB66	188	212	204.5	8.3	-
211		Najee Harris (LAC)	RB67	177	240	205	18.9	-
212		Keenan Allen (LAC)	WR86	186	219	205.2	11.5	-
213		Ray Davis (BUF)	RB68	202	226	207	8.8	-
214		Gunnar Helm (TEN)	TE26	185	225	208	12.1	-
215		Jonah Coleman (FA)	RB69	117	163	136	19.6	-
216		Chris Rodriguez Jr. (WAS)	RB70	211	215	212.3	1.5	-
217		Cooper Kupp (SEA)	WR87	203	241	212.7	13.1	-
218		Anthony Richardson Sr. (IND)	QB35	177	182	178.3	2.2	-
219		Jerome Ford (CLE)	RB71	176	252	199.4	27.3	-
220		Darius Slayton (NYG)	WR88	204	235	214.7	10.9	-
221		Tory Horton (SEA)	WR89	207	221	215.5	6.1	-
222		David Njoku (CLE)	TE27	208	227	217.7	7.4	-
223		Ollie Gordon II (MIA)	RB72	213	226	217.7	4.3	-
224		Chig Okonkwo (TEN)	TE28	208	223	219	5.7	-
225		Jaleel McLaughlin (DEN)	RB73	216	229	220.2	5.3	-
226		Ty Johnson (BUF)	RB74	216	244	222	9.9	-
227		Colby Parkinson (LAR)	TE29	206	231	222.2	8.6	-
228		Aaron Rodgers (PIT)	QB36	87	126	106.5	19.5	-
229		Isaiah Bond (CLE)	WR90	210	255	223.8	14.9	-
230		Tank Dell (HOU)	WR91	215	234	224.2	6.5	-
231		Pat Freiermuth (PIT)	TE30	225	239	231	4.4	-
232		Evan Engram (DEN)	TE31	227	240	231.5	4.5	-
233		Joe Milton III (DAL)	QB37	182	182	182	0	-
234		Jalen Royals (KC)	WR92	221	269	233.2	16.6	-
235		Konata Mumpfield (LAR)	WR93	219	251	233.8	11	-
236		Jack Bech (LV)	WR94	221	262	235.5	12.8	-
237		Cade Otton (TB)	TE32	227	243	235.5	5.2	-
238		Isaac Guerendo (SF)	RB75	225	235	228.2	4.1	-
239		Andrei Iosivas (CIN)	WR95	212	250	230.6	12.9	-
240		Omar Cooper Jr. (FA)	WR96	136	179	157.5	21.5	-
241		Devaughn Vele (NO)	WR97	218	266	240.7	13.9	-
242		Kenyon Sadiq (FA)	TE33	187	212	200.7	10.3	-
243		Jake Tonges (SF)	TE34	211	250	236.8	14.7	-
244		Malachi Fields (FA)	WR98	148	193	170.5	22.5	-
245		Audric Estime (NO)	RB76	229	261	237.6	11.8	-
246		Christian Kirk (HOU)	WR99	236	240	237.6	1.6	-
247		Mike Washington Jr. (FA)	RB77	172	173	172.5	0.5	-
248		Bam Knight (ARI)	RB78	226	268	238.2	16.2	-
249		Marquise Brown (KC)	WR100	241	267	247.3	9	-
250		Malik Davis (DAL)	RB79	232	265	240.8	12.2	-
251		Luke McCaffrey (WAS)	WR101	244	256	247.8	4.8	-
252		Calvin Austin III (PIT)	WR102	237	257	241.6	7.7	-
253		Chris Brazzell II (FA)	WR103	178	187	182.5	4.5	-
254		Jaydon Blue (DAL)	RB80	217	275	249	25.3	-
255		Kaytron Allen (FA)	RB81	155	213	184	29	-
256		Noah Gray (KC)	TE35	231	257	243.4	8.4	-
257		Tyquan Thornton (KC)	WR104	241	260	245.6	7.3	-
258		DJ Giddens (IND)	RB82	238	273	252.7	11.7	-
259		Dont'e Thornton Jr. (LV)	WR105	242	263	247.2	7.9	-
260		Elijah Sarratt (FA)	WR106	193	198	195.5	2.5	-
261		LeQuint Allen Jr. (JAC)	RB83	235	280	248.4	16.3	-
262		Cedric Tillman (CLE)	WR107	248	271	254.3	7.8	-
263		Malik Washington (MIA)	WR108	245	292	256.8	16.1	-
264		Germie Bernard (FA)	WR109	188	218	203	15	-
265		Eli Stowers (FA)	TE36	220	249	230	13.4	-
266		Mike Gesicki (CIN)	TE37	245	264	251.4	7.8	-
267		Nicholas Singleton (FA)	RB84	205	208	206.5	1.5	-
268		Zachariah Branch (FA)	WR110	190	224	207	17	-
269		Devin Singletary (NYG)	RB85	246	277	254	11.6	-
270		Chris Brooks (GB)	RB86	247	287	256	15.5	-
271		George Holani (SEA)	RB87	217	290	260.8	22	-
272		Olamide Zaccheaus (CHI)	WR111	253	299	263	16.2	-
273		Justice Hill (BAL)	RB88	250	284	257.6	13.2	-
274		Antonio Williams (FA)	WR112	219	227	223	4	-
275		Trevor Etienne (CAR)	RB89	252	281	258.4	11.4	-
276		Tez Johnson (TB)	WR113	256	294	264.7	13.3	-
277		John Bates (WAS)	TE38	240	309	260.3	28.3	-
278		John Metchie III (NYJ)	WR114	253	298	262.4	17.8	-
279		Ben Sinnott (WAS)	TE39	215	306	252.3	38.9	-
280		Darren Waller (MIA)	TE40	233	259	247.3	10.8	-
281		Jarquez Hunter (LAR)	RB90	255	276	261.4	8	-
282		Demond Claiborne (FA)	RB91	231	232	231.5	0.5	-
283		MarShawn Lloyd (GB)	RB92	258	274	261.8	6.1	-
284		Elijah Arroyo (SEA)	TE41	228	270	248.7	17.1	-
285		Jaylin Lane (WAS)	WR115	260	302	269	14.8	-
286		Michael Mayer (LV)	TE42	231	272	250	16.9	-
287		Joshua Palmer (BUF)	WR116	257	317	270.2	23.4	-
288		Chris Bell (FA)	WR117	195	334	264.5	69.5	-
289		Jordan James (SF)	RB93	225	339	278	36.2	-
290		Xavier Hutchinson (HOU)	WR118	261	323	275	24	-
291		Michael Carter (ARI)	RB94	262	301	271	15.1	-
292		Will Shipley (PHI)	RB95	261	320	275.4	22.4	-
293		DeMario Douglas (NE)	WR119	264	325	277	24	-
294		Samaje Perine (CIN)	RB96	268	311	275.8	15.8	-
295		Greg Dulcich (MIA)	TE43	219	295	257	38	-
296		Ja'Kobi Lane (FA)	WR120	221	221	221	0	-
297		Emari Demercado (ARI)	RB97	267	297	273	12	-
298		Jalen Nailor (MIN)	WR121	266	327	279	24	-
299		Adam Randall (FA)	RB98	223	223	223	0	-
300		Reggie Virgil (FA)	WR122	227	227	227	0	-
301		Darnell Washington (PIT)	TE44	228	303	265.5	37.5	-
302		Tommy Myers (FA)	TE45	250	262	256	6	-
303		Ted Hurst (FA)	WR123	231	231	231	0	-
304		Tahj Brooks (CIN)	RB99	269	314	279.2	15.7	-
305		Kareem Hunt (KC)	RB100	270	319	280.4	19.3	-
306		Austin Ekeler (WAS)	RB101	269	321	280.8	20.1	-
307		Nick Chubb (HOU)	RB102	271	315	280.8	17.1	-
308		Jared Wiley (KC)	TE46	244	244	244	0	-
309		Le'Veon Moss (FA)	RB103	246	246	246	0	-
310		Jam Miller (FA)	RB104	249	249	249	0	-
311		Tyler Higbee (LAR)	TE47	249	318	283.5	34.5	-
312		J'Mari Taylor (FA)	RB105	258	258	258	0	-
313		Jawhar Jordan (HOU)	RB106	275	288	278.6	4.8	-
314		Terrell Jennings (NE)	RB107	274	343	292	29.4	-
315		Antonio Gibson (NE)	RB108	277	279	277.7	0.9	-
316		Raheim Sanders (CLE)	RB109	278	324	290.3	19.5	-
317		Dameon Pierce (KC)	RB110	278	342	295	27.2	-
318		Deion Burks (FA)	WR124	275	275	275	0	-
319		Caleb Douglas (FA)	WR125	278	278	278	0	-
320		Tyren Montgomery (FA)	WR126	279	279	279	0	-
321		Skyler Bell (FA)	WR127	282	282	282	0	-
322		Ja'Tavion Sanders (CAR)	TE48	283	283	283	0	-
323		Kevin Coleman Jr. (FA)	WR128	285	285	285	0	-
324		Cole Kmet (CHI)	TE49	286	286	286	0	-
325		Barion Brown (FA)	WR129	289	289	289	0	-
326		Seth McGowan (FA)	RB111	291	291	291	0	-
327		Jaydn Ott (FA)	RB112	293	293	293	0	-
328		Kaelon Black (FA)	RB113	296	296	296	0	-
329		Luke Musgrave (GB)	TE50	300	300	300	0	-
330		Bryce Lance (FA)	WR130	304	304	304	0	-
331		Josh Cameron (FA)	WR131	305	305	305	0	-
332		Vinny Anthony II (FA)	WR132	307	307	307	0	-
333		Brenen Thompson (FA)	WR133	308	308	308	0	-
334		Max Klare (FA)	TE51	310	310	310	0	-
335		Dawson Knox (BUF)	TE52	312	312	312	0	-
336		Elijah Higgins (ARI)	TE53	313	313	313	0	-
337		Jonnu Smith (PIT)	TE54	316	316	316	0	-
338		Michael Trigg (FA)	TE55	322	322	322	0	-
339		Justin Joly (FA)	TE56	326	326	326	0	-
340		Aaron Anderson (FA)	WR134	328	328	328	0	-
341		Jack Endries (FA)	TE57	329	329	329	0	-
342		C.J. Daniels (FA)	WR135	330	330	330	0	-
343		Tanner Koziol (FA)	TE58	331	331	331	0	-
344		Dane Key (FA)	WR136	332	332	332	0	-
345		Chris Hilton Jr. (FA)	WR137	333	333	333	0	-
346		Robert Henry Jr. (FA)	RB114	335	335	335	0	-
347		Zach Ertz (WAS)	TE59	336	336	336	0	-
348		Desmond Reid (FA)	RB115	337	337	337	0	-
349		Roman Hemby (FA)	RB116	338	338	338	0	-
350		Thomas Fidone II (NYG)	TE60	340	340	340	0	-
351		Taysom Hill (NO)	TE61	341	341	341	0	-
352		Erick All Jr. (CIN)	TE62	344	344	344	0	-"""

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
    """Parse tab-separated lines. Col 2=name, 3=POS, 6=AVG (0-indexed)."""
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

    return f"""-- PPR / season / superflex baseline rankings
-- Inserts into baseline_community_rankings (matches players by name, season=2025)
-- Adds FA rookies to baseline_rookies if not in players or already in baseline_rookies

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

ins_baseline AS (
  INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank)
  SELECT
    'ppr'::text,
    'season'::text,
    true,
    pl.id,
    l.avg_rank
  FROM lookup l
  INNER JOIN public.players pl ON pl.name = l.match_name AND pl.season = 2025
  ON CONFLICT (scoring_format, league_type, is_superflex, player_id)
  DO UPDATE SET rank = EXCLUDED.rank
)

INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT l.input_name, l.position, l.avg_rank, 'ppr'::text, 'season'::text, true
FROM lookup l
WHERE l.is_fa = true
  AND NOT EXISTS (
    SELECT 1 FROM public.players p
    WHERE (p.name = l.match_name OR p.name = l.input_name) AND p.season = 2025
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.baseline_rookies br
    WHERE br.name = l.input_name
      AND br.scoring_format = 'ppr'
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
        out_path = "supabase/migrations/20260219210000_ppr_season_superflex_baseline.sql"
        with open(out_path, "w") as f:
            f.write(out)
        print(f"Wrote migration to {out_path}")
        print(f"Parsed {len(rows)} rows, {fa_count} FA players")
    else:
        print("-- PPR/season/superflex baseline: parsed", len(rows), "rows, FA:", fa_count)
        print("Run with --migration to generate migration file")


if __name__ == "__main__":
    main()
