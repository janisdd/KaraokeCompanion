# EBU R128 / FFmpeg loudnorm filter (from AI)

LRA (Loudness Range)
Describes how much the loudness varies over time (quiet vs loud parts), not “how loud on average.”
In loudnorm, target LRA steers how much the processor is allowed to reshape dynamics to hit your targets while keeping a 
plausible loudness range for the content type.

TP (True Peak)
A peak ceiling in dBTP (true peak, inter-sample peaks considered).
It limits how high the peaks can go after normalization; lowering TP makes the output more peak-safe (less risk of clipping 
on playback), often at the cost of more limiting/compression if I is held fixed.

Rough intuition: I = average loudness you’re aiming for, TP = “don’t let spikes poke above here,” LRA = “don’t let the loud/
quiet spread end up wildly wrong for this kind of material.”

TARGET_LRA_DEFAULT = 11.0
TARGET_TP_DEFAULT = -1.5