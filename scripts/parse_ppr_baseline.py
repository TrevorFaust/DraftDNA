#!/usr/bin/env python3
"""
Parse PPR/season/non-superflex baseline rankings and output SQL for migration.
Input format: RK, WSID, Player Name (can be on separate line), POS, BEST, WORST, AVG, ...
Uses column 7 (AVG) for rank value.
FA players: track for baseline_rookies insert.
"""

import re
import sys

# Raw data from user - 352 players
RAW = r"""1		
Ja'Marr Chase (CIN)
WR1	1	3	1.7	0.9	
-
2		
Bijan Robinson (ATL)
RB1	2	2	2.0	0.0	
-
3		
Puka Nacua (LAR)
WR2	1	3	2.3	0.9	
-
4		
Jaxon Smith-Njigba (SEA)
WR3	4	4	4.0	0.0	
-
5		
Jahmyr Gibbs (DET)
RB2	5	5	5.0	0.0	
-
6		
CeeDee Lamb (DAL)
WR4	6	8	6.7	0.9	
-
7		
Amon-Ra St. Brown (DET)
WR5	6	8	7.3	0.9	
-
8		
Christian McCaffrey (SF)
RB3	7	10	7.5	1.1	
-
9		
Justin Jefferson (MIN)
WR6	9	14	10.8	1.7	
-
10		
Drake London (ATL)
WR7	9	15	11.3	2.0	
-
11		
Malik Nabers (NYG)
WR8	9	12	11.3	1.1	
-
12		
Jonathan Taylor (IND)
RB4	10	13	11.5	1.5	
-
13		
De'Von Achane (MIA)
RB5	10	13	12.0	1.4	
-
14		
Nico Collins (HOU)
WR9	11	15	14.2	1.5	
-
15		
Rashee Rice (KC)
WR10	12	19	15.2	2.5	
-
16		
Chris Olave (NO)
WR11	14	20	17.7	2.4	
-
17		
George Pickens (DAL)
WR12	15	19	17.8	1.3	
-
18		
Ashton Jeanty (LV)
RB6	17	23	18.7	2.4	
-
19		
Trey McBride (ARI)
TE1	16	22	19.0	3.0	
-
20		
Brock Bowers (LV)
TE2	16	22	19.0	3.0	
-
21		
James Cook III (BUF)
RB7	17	21	19.0	2.0	
-
22		
A.J. Brown (PHI)
WR13	19	26	20.8	2.3	
-
23		
Omarion Hampton (LAC)
RB8	23	24	23.2	0.4	
-
24		
Chase Brown (CIN)
RB9	21	31	24.2	3.3	
-
25		
Josh Allen (BUF)
QB1	25	25	25.0	0.0	
-
26		
Tetairoa McMillan (CAR)
WR14	19	28	25.2	2.9	
-
27		
Tee Higgins (CIN)
WR15	28	29	28.5	0.5	
-
28		
Lamar Jackson (BAL)
QB2	27	30	29.0	1.4	
-
29		
Drake Maye (NE)
QB3	27	37	29.7	3.5	
-
30		
Saquon Barkley (PHI)
RB10	23	34	31.0	3.8	
-
31		
Garrett Wilson (NYJ)
WR16	28	35	31.7	3.4	
-
32		
Josh Jacobs (GB)
RB11	24	41	33.3	5.0	
-
33		
Bucky Irving (TB)
RB12	33	39	35.0	2.8	
-
34		
Breece Hall (NYJ)
RB13	31	46	37.7	5.5	
-
35		
Davante Adams (LAR)
WR17	35	45	38.0	3.5	
-
36		
Joe Burrow (CIN)
QB4	30	54	38.7	7.3	
-
37		
Ladd McConkey (LAC)
WR18	35	44	39.0	3.4	
-
38		
Jameson Williams (DET)
WR19	36	44	40.3	3.1	
-
39		
Zay Flowers (BAL)
WR20	36	48	40.7	3.9	
-
40		
Derrick Henry (BAL)
RB14	39	46	41.5	2.4	
-
41		
Jaylen Waddle (MIA)
WR21	40	51	43.7	3.8	
-
42		
DeVonta Smith (PHI)
WR22	36	49	44.5	4.5	
-
43		
Kyren Williams (LAR)
RB15	43	47	46.0	1.4	
-
44		
Terry McLarin (WAS)
WR23	42	49	46.2	2.7	
-
45		
Kenneth Walker III (SEA)
RB16	41	53	46.7	4.0	
-
46		
Luther Burden III (CHI)
WR24	42	51	46.7	3.2	
-
47		
Mike Evans (TB)
WR25	40	51	47.3	3.9	
-
48		
RJ Harvey (DEN)
RB17	41	56	50.8	5.5	
-
49		
Harold Fannin Jr. (CLE)
TE3	32	73	52.5	20.5	
-
50		
Colston Loveland (CHI)
TE4	32	57	52.8	9.3	
-
51		
Courtland Sutton (DEN)
WR26	48	60	53.3	3.9	
-
52		
Emeka Egbuka (TB)
WR27	45	60	53.5	5.5	
-
53		
Travis Etienne Jr. (JAC)
RB18	47	61	53.7	5.0	
-
54		
Jayden Daniels (WAS)
QB5	37	70	53.8	9.5	
-
55		
Cam Skattebo (NYG)
RB19	47	58	53.8	3.5	
-
56		
TreVeyon Henderson (NE)
RB20	43	58	54.0	5.2	
-
57		
Javonte Williams (DAL)
RB21	47	61	55.3	5.0	
-
58		
Christian Watson (GB)
WR28	48	68	57.2	7.5	
-
59		
Jalen Hurts (PHI)
QB6	54	63	58.8	2.6	
-
60		
Quinshon Judkins (CLE)
RB22	58	65	61.8	2.5	
-
61		
DK Metcalf (PIT)
WR29	55	69	62.7	4.3	
-
62		
Jakobi Meyers (JAC)
WR30	52	83	64.2	9.3	
-
63		
Rome Odunze (CHI)
WR31	38	81	64.5	15.3	
-
64		
Tucker Kraft (GB)
TE5	57	66	64.5	3.4	
-
65		
Jaxson Dart (NYG)
QB7	59	79	65.0	6.4	
-
66		
D'Andre Swift (CHI)
RB23	65	67	66.0	1.0	
-
67		
Brian Thomas Jr. (JAC)
WR32	60	76	66.3	6.1	
-
68		
Tyler Warren (IND)
TE6	57	73	68.0	5.8	
-
69		
Ricky Pearsall (SF)
WR33	55	76	68.8	7.0	
-
70		
Justin Herbert (LAC)
QB8	63	79	70.3	4.6	
-
71		
Jaylen Warren (PIT)
RB24	67	72	70.3	2.4	
-
72		
Stefon Diggs (NE)
WR34	69	83	73.5	6.4	
-
73		
Chris Godwin Jr. (TB)
WR35	64	88	74.7	8.1	
-
74		
Kyle Monangai (CHI)
RB25	77	86	80.0	3.6	
-
75		
Trevor Lawrence (JAC)
QB9	70	92	80.3	9.0	
-
76		
Rhamondre Stevenson (NE)
RB26	72	89	81.0	7.3	
-
77		
Rico Dowdle (CAR)
RB27	75	102	82.2	9.3	
-
78		
Caleb Williams (CHI)
QB10	70	101	82.3	13.3	
-
79		
Tony Pollard (TEN)
RB28	78	86	83.3	2.5	
-
80		
Marvin Harrison Jr. (ARI)
WR36	81	91	84.3	4.4	
-
81		
Michael Wilson (ARI)
WR37	81	90	84.3	3.4	
-
82		
Sam LaPorta (DET)
TE7	85	87	85.3	0.8	
-
83		
Michael Pittman Jr. (IND)
WR38	82	94	86.8	4.5	
-
84		
Patrick Mahomes II (KC)
QB11	74	98	88.8	9.2	
-
85		
Kyle Pitts Sr. (ATL)
TE8	85	95	89.3	4.1	
-
86		
Blake Corum (LAR)
RB29	86	103	91.7	5.8	
-
87		
Dak Prescott (DAL)
QB12	79	101	93.3	7.2	
-
88		
Brock Purdy (SF)
QB13	79	101	93.3	7.2	
-
89		
Jordan Addison (MIN)
WR39	90	100	94.0	4.5	
-
90		
James Conner (ARI)
RB30	80	122	95.2	14.0	
-
91		
Bhayshul Tuten (JAC)
RB31	80	117	95.2	13.4	
-
92		
Wan'Dale Robinson (NYG)
WR40	91	109	96.8	6.3	
-
93		
Chuba Hubbard (CAR)
RB32	77	118	99.0	15.2	
-
94		
Quentin Johnston (LAC)
WR41	88	116	100.5	8.9	
-
95		
Dalton Kincaid (BUF)
TE9	95	111	100.5	5.9	
-
96		
Woody Marks (HOU)
RB33	80	122	100.8	16.4	
-
97		
Aaron Jones Sr. (MIN)
RB34	86	120	100.8	13.8	
-
98		
Trey Benson (ARI)
RB35	86	117	102.0	9.0	
-
99		
Khalil Shakir (BUF)
WR42	94	123	102.7	10.4	
-
100		
Zach Charbonnet (SEA)
RB36	72	169	103.7	38.7	
-
101		
Alec Pierce (IND)
WR43	90	115	104.5	8.9	
-
102		
Jauan Jennings (SF)
WR44	91	115	104.8	9.3	
-
103		
Alvin Kamara (NO)
RB37	99	118	105.7	8.4	
-
104		
Matthew Stafford (LAR)
QB14	104	113	105.8	3.2	
-
105		
Bo Nix (DEN)
QB15	104	108	106.3	1.7	
-
106		
Oronde Gadsden II (LAC)
TE10	106	111	106.8	1.9	
-
107		
Jake Ferguson (DAL)
TE11	97	124	107.7	9.3	
-
108		
Brenton Strange (JAC)
TE12	95	112	108.8	6.2	
-
109		
Jordan Love (GB)
QB16	104	119	109.0	5.4	
-
110		
Jared Goff (DET)
QB17	108	114	111.5	2.5	
-
111		
Parker Washington (JAC)
WR45	76	136	111.7	19.9	
-
112		
Juwan Johnson (NO)
TE13	97	124	113.2	9.2	
-
113		
Travis Hunter (JAC)
WR46	82	154	114.0	26.3	
-
114		
Baker Mayfield (TB)
QB18	113	125	116.5	4.3	
-
115		
DJ Moore (CHI)
WR47	110	133	116.7	8.4	
-
116		
Tyreek Hill (FA)
WR48	109	150	117.2	14.9	
-
117		
David Montgomery (DET)
RB38	103	130	120.5	9.1	
-
118		
Jacory Croskey-Merritt (WAS)
RB39	99	132	121.3	11.0	
-
119		
Jayden Higgins (HOU)
WR49	109	142	121.5	11.8	
-
120		
Malik Willis (GB)
QB19	108	134	123.0	8.7	
-
121		
Xavier Worthy (KC)
WR50	121	126	123.3	2.0	
-
122		
Tyler Shough (NO)
QB20	114	129	124.5	5.0	
-
123		
Dylan Sampson (CLE)
RB40	120	135	124.8	6.2	
-
124		
Jayden Reed (GB)
WR51	116	137	125.2	8.1	
-
125		
George Kittle (SF)
TE14	87	173	127.7	27.6	
-
126		
Josh Downs (IND)
WR52	123	140	129.0	5.8	
-
127		
Braelon Allen (NYJ)
RB41	122	141	129.8	6.3	
-
128		
Dalton Schultz (HOU)
TE15	124	131	129.8	2.6	
-
129		
C.J. Stroud (HOU)
QB21	119	139	130.0	6.6	
-
130		
Deebo Samuel Sr. (WAS)
WR53	121	166	130.0	16.3	
-
131		
Kenneth Gainwell (PIT)
RB42	127	148	133.2	6.8	
-
132		
Tyler Allgeier (ATL)
RB43	117	143	133.3	7.9	
-
133		
Sam Darnold (SEA)
QB22	134	139	136.5	2.5	
-
134		
Jalen Coker (CAR)
WR54	116	150	136.7	10.2	
-
135		
Dallas Goedert (PHI)
TE16	131	144	137.8	3.8	
-
136		
Kyler Murray (ARI)
QB23	119	153	138.5	10.7	
-
137		
Tyjae Spears (TEN)
RB44	130	156	139.0	9.0	
-
138		
Tyrone Tracy Jr. (NYG)
RB45	135	146	141.5	3.5	
-
139		
Adonai Mitchell (NYJ)
WR55	137	168	144.2	10.7	
-
140		
Cam Ward (TEN)
QB24	134	153	144.5	6.2	
-
141		
Jerry Jeudy (CLE)
WR56	133	165	145.3	13.6	
-
142		
Troy Franklin (DEN)
WR57	133	170	145.8	14.8	
-
143		
J.K. Dobbins (DEN)
RB46	143	157	146.0	5.0	
-
144		
Hunter Henry (NE)
TE17	138	158	148.0	8.3	
-
145		
Jordan Mason (MIN)
RB47	143	156	148.0	4.5	
-
146		
Rachaad White (TB)
RB48	143	164	150.7	8.2	
-
147		
Houston Texans (HOU)
DST1	151	151	151.0	0.0	
-
148		
Kaleb Johnson (PIT)
RB49	148	160	151.3	4.3	
-
149		
Rashid Shaheed (SEA)
WR58	142	166	156.0	9.4	
-
150		
Jeremiyah Love (FA)
RB50	31	288	156.3	114.5	
-
151		
Chimere Dike (TEN)
WR59	142	170	157.5	10.8	
-
152		
Bryce Young (CAR)
QB25	147	179	159.3	9.8	
-
153		
Brandon Aiyuk (SF)
WR60	150	174	159.5	8.9	
-
154		
Travis Kelce (KC)
TE18	144	196	161.2	18.3	
-
155		
Tre Harris (LAC)
WR61	137	184	161.8	17.5	
-
156		
Denver Broncos (DEN)
DST2	161	167	162.0	2.2	
-
157		
Carnell Tate (FA)
WR62	81	258	162.7	72.2	
-
158		
Devin Neal (NO)
RB51	157	175	163.0	5.8	
-
159		
K.C. Concepcion (FA)
WR63	83	241	163.8	59.6	
-
160		
Tank Bigsby (PHI)
RB52	156	189	165.7	12.4	
-
161		
Isaiah Likely (BAL)
TE19	158	181	165.7	10.8	
-
162		
Isiah Pacheco (KC)
RB53	152	182	165.8	11.8	
-
163		
Matthew Golden (GB)
WR64	165	168	165.8	1.1	
-
164		
Jaylin Noel (HOU)
WR65	154	180	166.0	10.7	
-
165		
Seattle Seahawks (SEA)
DST3	161	167	166.0	2.2	
-
166		
Jordyn Tyson (FA)
WR66	94	239	167.0	67.4	
-
167		
Mark Andrews (BAL)
TE20	155	173	167.0	8.5	
-
168		
Romeo Doubs (GB)
WR67	154	176	167.8	7.5	
-
169		
Fernando Mendoza (FA)
QB26	139	242	170.3	41.7	
-
170		
Elic Ayomanor (TEN)
WR68	165	184	170.7	6.7	
-
171		
Kimani Vidal (LAC)
RB54	157	222	171.5	22.7	
-
172		
Philadelphia Eagles (PHI)
DST4	171	172	171.8	0.4	
-
173		
Makai Lemon (FA)
WR69	91	262	172.8	64.4	
-
174		
Los Angeles Rams (LAR)
DST5	171	183	173.0	4.5	
-
175		
J.J. McCarthy (MIN)
QB27	153	214	174.3	28.1	
-
176		
Kayshon Boutte (NE)
WR70	170	180	174.3	3.5	
-
177		
Keaton Mitchell (BAL)
RB55	160	228	176.7	23.6	
-
178		
Pat Bryant (DEN)
WR71	166	205	178.2	13.3	
-
179		
Minnesota Vikings (MIN)
DST6	183	183	183.0	0.0	
-
180		
Brian Robinson Jr. (SF)
RB56	169	201	183.3	10.7	
-
181		
Theo Johnson (NYG)
TE21	181	203	184.7	8.2	
-
182		
Kendre Miller (NO)
RB57	162	238	185.0	25.5	
-
183		
New England Patriots (NE)
DST7	185	185	185.0	0.0	
-
184		
Jacksonville Jaguars (JAC)
DST8	186	186	186.0	0.0	
-
185		
Brandon Aubrey (DAL)
K1	187	187	187.0	0.0	
-
186		
Los Angeles Chargers (LAC)
DST9	188	188	188.0	0.0	
-
187		
Green Bay Packers (GB)
DST10	190	190	190.0	0.0	
-
188		
Joe Mixon (HOU)
RB58	164	231	190.2	29.1	
-
189		
Michael Penix Jr. (ATL)
QB28	179	214	190.7	16.5	
-
190		
Isaiah Davis (NYJ)
RB59	152	228	190.8	26.6	
-
191		
Pittsburgh Steelers (PIT)
DST11	191	191	191.0	0.0	
-
192		
Denzel Boston (FA)
WR72	82	168	128.0	30.8	
-
193		
Ka'imi Fairbairn (HOU)
K2	192	192	192.0	0.0	
-
194		
Tre Tucker (LV)
WR73	174	208	192.8	13.3	
-
195		
Cam Little (JAC)
K3	193	193	193.0	0.0	
-
196		
Ryan Flournoy (DAL)
WR74	178	210	194.0	15.4	
-
197		
Darnell Mooney (ATL)
WR75	180	227	195.0	16.6	
-
198		
Cleveland Browns (CLE)
DST12	194	206	196.0	4.5	
-
199		
Cameron Dicker (LAC)
K4	198	198	198.0	0.0	
-
200		
Jalen McMillan (TB)
WR76	178	227	198.8	16.2	
-
201		
Evan McPherson (CIN)
K5	200	204	201.3	1.9	
-
202		
T.J. Hockenson (MIN)
TE22	196	226	203.2	11.3	
-
203		
Jason Myers (SEA)
K6	204	207	204.5	1.1	
-
204		
Daniel Jones (IND)
QB29	147	255	205.2	39.8	
-
205		
Tyler Loop (BAL)
K7	200	211	207.2	3.7	
-
206		
Emanuel Wilson (GB)
RB60	182	234	208.2	22.0	
-
207		
Terrance Ferguson (LAR)
TE23	173	236	208.8	20.4	
-
208		
Kansas City Chiefs (KC)
DST13	206	212	209.0	3.0	
-
209		
Jaylen Wright (MIA)
RB61	201	233	209.3	12.5	
-
210		
Andy Borregales (NE)
K8	207	211	209.7	1.9	
-
211		
Keon Coleman (BUF)
WR77	195	232	211.5	14.9	
-
212		
AJ Barner (SEA)
TE24	196	226	211.5	11.2	
-
213		
Mack Hollins (NE)
WR78	195	230	211.7	15.6	
-
214		
Marvin Mims Jr. (DEN)
WR79	199	244	212.2	15.6	
-
215		
Detroit Lions (DET)
DST14	194	248	213.0	16.8	
-
216		
Eddy Pineiro (SF)
K9	213	213	213.0	0.0	
-
217		
Isaac TeSlaa (DET)
WR80	202	225	213.5	8.9	
-
218		
Jadarian Price (FA)
RB62	89	122	110.3	15.1	
-
219		
Chase McLaughlin (TB)
K10	215	216	215.2	0.4	
-
220		
Calvin Ridley (TEN)
WR81	195	232	216.2	14.5	
-
221		
Cairo Santos (CHI)
K11	216	217	216.2	0.4	
-
222		
Mason Taylor (NYJ)
TE25	203	226	216.5	9.7	
-
223		
Jonathon Brooks (CAR)
RB63	160	243	217.8	29.1	
-
224		
Emmett Johnson (FA)
RB64	99	141	119.0	17.2	
-
225		
Buffalo Bills (BUF)
DST15	220	220	220.0	0.0	
-
226		
Brashard Smith (KC)
RB65	175	257	220.5	26.3	
-
227		
Xavier Legette (CAR)
WR82	205	239	220.5	14.7	
-
228		
Rashod Bateman (BAL)
WR83	208	241	220.8	10.8	
-
229		
Kyle Williams (NE)
WR84	208	239	222.0	10.8	
-
230		
Harrison Mevis (LAR)
K12	217	249	222.3	11.9	
-
231		
Najee Harris (LAC)
RB66	177	271	223.0	27.6	
-
232		
Keenan Allen (LAC)
WR85	210	241	225.2	12.5	
-
233		
Dontayvion Wicks (GB)
WR86	218	243	225.3	8.5	
-
234		
Sean Tucker (TB)
RB67	219	233	226.3	5.5	
-
235		
Jonah Coleman (FA)
RB68	117	169	134.7	24.3	
-
236		
Jerome Ford (CLE)
RB69	175	288	209.2	42.3	
-
237		
Gunnar Helm (TEN)
TE26	209	256	230.8	13.9	
-
238		
Ray Davis (BUF)
RB70	222	257	230.8	12.5	
-
239		
Chris Rodriguez Jr. (WAS)
RB71	231	237	233.3	2.7	
-
240		
Cooper Kupp (SEA)
WR87	223	272	234.7	17.1	
-
241		
Jake Bates (DET)
K13	217	240	236.2	8.6	
-
242		
Baltimore Ravens (BAL)
DST16	235	249	237.3	5.2	
-
243		
Tory Horton (SEA)
WR88	227	245	239.5	5.9	
-
244		
Darius Slayton (NYG)
WR89	224	276	240.3	18.3	
-
245		
David Njoku (CLE)
TE27	229	254	241.3	10.6	
-
246		
Chig Okonkwo (TEN)
TE28	236	246	242.7	4.7	
-
247		
Ollie Gordon II (MIA)
RB72	234	257	243.3	8.2	
-
248		
Ty Johnson (BUF)
RB73	237	275	245.5	13.4	
-
249		
Jaleel McLaughlin (DEN)
RB74	237	266	246.2	12.0	
-
250		
Isaiah Bond (CLE)
WR90	230	291	248.0	20.3	
-
251		
Tank Dell (HOU)
WR91	241	262	249.8	7.6	
-
252		
Colby Parkinson (LAR)
TE29	229	259	251.0	10.0	
-
253		
Chris Boswell (PIT)
K14	252	252	252.0	0.0	
-
254		
Shedeur Sanders (CLE)
QB30	242	312	259.2	26.5	
-
255		
Wil Lutz (DEN)
K15	253	282	259.3	10.7	
-
256		
Jalen Royals (KC)
WR92	244	305	260.2	21.1	
-
257		
Pat Freiermuth (PIT)
TE30	256	268	260.5	3.8	
-
258		
Evan Engram (DEN)
TE31	254	274	261.5	7.3	
-
259		
Atlanta Falcons (ATL)
DST17	235	280	261.8	18.1	
-
260		
Charlie Smyth (NO)
K16	250	253	251.2	1.5	
-
261		
Konata Mumpfield (LAR)
WR93	241	287	264.3	17.6	
-
262		
Isaac Guerendo (SF)
RB75	248	266	254.0	7.6	
-
263		
Harrison Butker (KC)
K17	250	282	265.8	15.5	
-
264		
Cade Otton (TB)
TE32	256	281	265.8	8.0	
-
265		
Jack Bech (LV)
WR94	244	298	267.0	17.8	
-
266		
Andrei Iosivas (CIN)
WR95	232	286	257.8	18.3	
-
267		
Devaughn Vele (NO)
WR96	239	302	269.0	18.3	
-
268		
Omar Cooper Jr. (FA)
WR97	137	199	168.0	31.0	
-
269		
New Orleans Saints (NO)
DST18	249	279	270.5	11.8	
-
270		
Mike Washington Jr. (FA)
RB76	169	182	175.5	6.5	
-
271		
Kenyon Sadiq (FA)
TE33	203	236	225.0	15.6	
-
272		
Jacoby Brissett (ARI)
QB31	255	285	274.3	13.7	
-
273		
San Francisco 49ers (SF)
DST19	212	280	251.8	29.4	
-
274		
Christian Kirk (HOU)
WR98	264	270	266.4	2.6	
-
275		
Malachi Fields (FA)
WR99	149	225	187.0	38.0	
-
276		
Bam Knight (ARI)
RB77	251	304	266.8	20.0	
-
277		
Audric Estime (NO)
RB78	257	297	267.4	14.9	
-
278		
Jake Tonges (SF)
TE34	246	281	268.2	13.7	
-
279		
Marquise Brown (KC)
WR100	269	303	277.0	11.9	
-
280		
Malik Davis (DAL)
RB79	260	301	270.6	15.3	
-
281		
Chris Brazzell II (FA)
WR101	197	197	197.0	0.0	
-
282		
Calvin Austin III (PIT)
WR102	265	293	271.4	10.8	
-
283		
Jaydon Blue (DAL)
RB80	243	309	280.2	28.0	
-
284		
Luke McCaffrey (WAS)
WR103	272	290	280.5	7.9	
-
285		
Kaytron Allen (FA)
RB81	157	248	202.5	45.5	
-
286		
Tyquan Thornton (KC)
WR104	269	296	275.4	10.4	
-
287		
Noah Gray (KC)
TE35	259	292	276.6	12.7	
-
288		
DJ Giddens (IND)
RB82	266	310	284.0	15.1	
-
289		
Aaron Rodgers (PIT)
QB32	214	339	271.0	45.1	
-
290		
Dont'e Thornton Jr. (LV)
WR105	270	299	277.0	11.0	
-
291		
Mac Jones (SF)
QB33	276	310	284.2	12.8	
-
292		
LeQuint Allen Jr. (JAC)
RB83	263	317	278.4	19.7	
-
293		
Elijah Sarratt (FA)
WR106	208	230	219.0	11.0	
-
294		
Cedric Tillman (CLE)
WR107	277	307	286.7	10.0	
-
295		
Malik Washington (MIA)
WR108	277	331	290.5	18.6	
-
296		
Germie Bernard (FA)
WR109	199	258	228.5	29.5	
-
297		
Devin Singletary (NYG)
RB84	275	314	285.0	14.8	
-
298		
Zachariah Branch (FA)
WR110	202	264	233.0	31.0	
-
299		
Mike Gesicki (CIN)
TE36	274	300	285.6	10.2	
-
300		
Chris Brooks (GB)
RB85	275	326	287.0	19.5	
-
301		
George Holani (SEA)
RB86	238	329	293.2	27.5	
-
302		
Nicholas Singleton (FA)
RB87	228	243	235.5	7.5	
-
303		
Tua Tagovailoa (MIA)
QB34	285	308	293.0	9.0	
-
304		
Eli Stowers (FA)
TE37	246	299	266.3	23.3	
-
305		
Olamide Zaccheaus (CHI)
WR111	286	341	297.7	19.5	
-
306		
Justice Hill (BAL)
RB88	283	322	291.0	15.5	
-
307		
John Bates (WAS)
TE38	268	352	292.0	34.7	
-
308		
Trevor Etienne (CAR)
RB89	284	318	291.6	13.3	
-
309		
Tez Johnson (TB)
WR112	289	334	299.0	15.8	
-
310		
John Metchie III (NYJ)
WR113	286	340	297.4	21.3	
-
311		
Antonio Williams (FA)
WR114	245	267	256.0	11.0	
-
312		
Indianapolis Colts (IND)
DST20	280	317	294.8	18.1	
-
313		
Ben Sinnott (WAS)
TE39	236	349	288.0	46.6	
-
314		
Will Reichard (MIN)
K18	204	313	258.5	54.5	
-
315		
Darren Waller (MIA)
TE40	261	295	279.0	13.9	
-
316		
Jarquez Hunter (LAR)
RB90	288	313	295.4	9.4	
-
317		
Jaylin Lane (WAS)
WR115	293	344	303.7	18.1	
-
318		
MarShawn Lloyd (GB)
RB91	291	311	295.8	7.6	
-
319		
Joshua Palmer (BUF)
WR116	290	362	305.8	28.1	
-
320		
Demond Claiborne (FA)
RB92	263	271	267.0	4.0	
-
321		
Elijah Arroyo (SEA)
TE41	256	306	286.0	21.6	
-
322		
Michael Mayer (LV)
TE42	259	309	287.0	20.9	
-
323		
Jordan James (SF)
RB93	251	387	314.2	43.2	
-
324		
Xavier Hutchinson (HOU)
WR117	294	369	310.8	29.1	
-
325		
Michael Carter (ARI)
RB94	295	343	305.8	18.7	
-
326		
Chris Bell (FA)
WR118	227	380	303.5	76.5	
-
327		
Will Shipley (PHI)
RB95	294	365	311.0	27.1	
-
328		
DeMario Douglas (NE)
WR119	297	371	312.8	29.1	
-
329		
Samaje Perine (CIN)
RB96	302	354	311.5	19.0	
-
330		
Miami Dolphins (MIA)
DST21	263	356	310.4	29.9	
-
331		
Emari Demercado (ARI)
RB97	300	338	307.8	15.1	
-
332		
Jalen Nailor (MIN)
WR120	299	373	314.8	29.1	
-
333		
Anthony Richardson Sr. (IND)
QB35	301	321	306.4	7.5	
-
334		
Tahj Brooks (CIN)
RB98	303	358	315.0	19.3	
-
335		
Tommy Myers (FA)
TE43	281	295	288.0	7.0	
-
336		
Greg Dulcich (MIA)
TE44	259	336	297.5	38.5	
-
337		
Kareem Hunt (KC)
RB99	304	364	316.8	23.6	
-
338		
Austin Ekeler (WAS)
RB100	303	366	317.2	24.4	
-
339		
Geno Smith (LV)
QB36	303	348	315.0	15.0	
-
340		
Nick Chubb (HOU)
RB101	305	360	317.2	21.4	
-
341		
Darnell Washington (PIT)
TE45	268	345	306.5	38.5	
-
342		
Zane Gonzalez (ATL)
K19	297	333	314.7	10.9	
-
343		
Joe Milton III (DAL)
QB37	308	359	319.0	20.0	
-
344		
Tyler Higbee (LAR)
TE46	281	363	322.0	41.0	
-
345		
Jawhar Jordan (HOU)
RB102	311	327	315.2	6.0	
-
346		
Terrell Jennings (NE)
RB103	309	391	330.5	34.9	
-
347		
Tyrod Taylor (NYJ)
QB38	304	311	307.5	3.5	
-
348		
Ty Simpson (FA)
QB39	298	324	311.0	13.0	
-
349		
Antonio Gibson (NE)
RB104	313	315	313.7	0.9	
-
350		
Raheim Sanders (CLE)
RB105	314	370	328.8	23.8	
-
351		
Dameon Pierce (KC)
RB106	314	390	334.0	32.4	
-
352		
Marcus Mariota (WAS)
QB40	309	386	347.5	38.5	
-"""

# Name aliases: rankings name -> possible DB name (for players table matching)
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
    "Terry McLarin": "Terry McLaurin",  # typo in source
    "Jonathon Brooks": "Jonathan Brooks",  # common spelling
    "Travis Etienne Jr.": "Travis Etienne",
    "Michael Penix Jr.": "Michael Penix",
}


def extract_name(raw: str) -> str:
    """Extract player name from 'Name (TEAM)' or 'Name (FA)' format."""
    raw = raw.strip()
    # Match "Name (XXX)" - team code or FA
    m = re.match(r"^(.+?)\s*\((?:FA|[A-Z]{2,3})\)\s*$", raw)
    if m:
        return m.group(1).strip()
    return raw


def extract_position(pos_col: str) -> str:
    """Extract position from POS column e.g. WR1 -> WR, DST1 -> D/ST, K1 -> K."""
    pos_col = pos_col.strip().upper()
    if pos_col.startswith("DST"):
        return "D/ST"
    if len(pos_col) >= 2:
        return pos_col[:2] if pos_col[:2] in ("QB", "RB", "WR", "TE") else pos_col[:1]
    return pos_col


def parse() -> list[tuple[int, str, str, float, bool]]:
    """Parse raw data. Returns list of (ordinal, name, position, avg_rank, is_fa)."""
    lines = RAW.strip().split("\n")
    rows = []
    i = 0
    while i < len(lines):
        line = lines[i]
        # Skip header and tier lines
        if "RK" in line or "Tier" in line or "Customize" in line or not line.strip():
            i += 1
            continue
        # Match ordinal rank at start
        m = re.match(r"^(\d+)\s*$", line.strip())
        if m:
            rk = int(m.group(1))
            i += 1
            # Next non-empty line is player name
            name_line = ""
            while i < len(lines) and not lines[i].strip():
                i += 1
            if i < len(lines):
                name_line = lines[i].strip()
                i += 1
            # Next line has POS, BEST, WORST, AVG
            pos_line = ""
            while i < len(lines) and not lines[i].strip():
                i += 1
            if i < len(lines):
                pos_line = lines[i]
                i += 1
            parts = pos_line.split("\t")
            if len(parts) >= 4:
                pos = extract_position(parts[0])
                try:
                    avg = float(parts[3].strip())
                except (ValueError, IndexError):
                    avg = float(rk)
                name = extract_name(name_line) if name_line else ""
                is_fa = "(FA)" in name_line
                if name:
                    rows.append((rk, name, pos, avg, is_fa))
        else:
            i += 1
    return rows


def esc(s: str) -> str:
    return s.replace("'", "''")


def generate_migration() -> str:
    """Generate full SQL migration for PPR/season/non-superflex baseline."""
    rows = parse()

    # Build VALUES for parsed data
    values_lines = []
    for rk, name, pos, avg, is_fa in rows:
        values_lines.append(f"    ('{esc(name)}', '{pos}', {avg}::numeric, {str(is_fa).lower()})")
    values_sql = ",\n".join(values_lines)

    # Build alias VALUES
    alias_lines = [
        f"    ('{esc(k)}', '{esc(v)}')" for k, v in ALIASES.items()
    ]
    alias_sql = ",\n".join(alias_lines)

    return f"""-- PPR / season / non-superflex baseline rankings
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

-- Insert baseline_community_rankings for all players that exist in players (season 2025)
ins_baseline AS (
  INSERT INTO public.baseline_community_rankings (scoring_format, league_type, is_superflex, player_id, rank)
  SELECT 
    'ppr'::text,
    'season'::text,
    false,
    pl.id,
    l.avg_rank
  FROM lookup l
  INNER JOIN public.players pl ON pl.name = l.match_name AND pl.season = 2025
  ON CONFLICT (scoring_format, league_type, is_superflex, player_id)
  DO UPDATE SET rank = EXCLUDED.rank
)

-- Insert FA rookies not in players and not already in baseline_rookies
INSERT INTO public.baseline_rookies (name, position, rank, scoring_format, league_type, is_superflex)
SELECT l.input_name, l.position, l.avg_rank, 'ppr'::text, 'season'::text, false
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
      AND br.is_superflex = false
  )
ON CONFLICT (scoring_format, league_type, is_superflex, name) DO NOTHING;
"""


def main():
    rows = parse()
    fa_count = sum(1 for r in rows if r[4])

    if len(sys.argv) > 1 and sys.argv[1] == "--migration":
        out = generate_migration()
        out_path = "supabase/migrations/20260219180000_ppr_season_non_sf_baseline.sql"
        with open(out_path, "w") as f:
            f.write(out)
        print(f"Wrote migration to {out_path}")
        print(f"Parsed {len(rows)} rows, {fa_count} FA players")
    else:
        print("-- PPR/season/non-superflex baseline: parsed", len(rows), "rows")
        print("-- FA players for baseline_rookies:", fa_count)
        print()
        print("Run with --migration to generate migration file")


if __name__ == "__main__":
    main()
