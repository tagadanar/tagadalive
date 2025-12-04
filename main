include('auto');

init()
debug("init ok")

// Use tagadalive AI
debug("combo search...")
Combo combo = AI.getPotentialCombo()
debug("combo: " + combo)

if(combo) {
    debug("playing " + count(combo.actions))
    combo.play()
} else {
    // Fallback: simple attack
    debug("fallback")
    var enemy = getNearestEnemy()
    var myWeps = getWeapons()
    if (enemy != null && myWeps != null && count(myWeps) > 0) {
        setWeapon(myWeps[0])
        moveToward(enemy)
        while(getTP() >= 3) {
            if(useWeapon(enemy) != 1) break
        }
    }
}

// cast avec le reste des TP
function failSafe(){
	var tpleft = getTP()
	if(getAbsoluteShield(Fight.self.id)<=0) Items.getItem(CHIP_ARMOR)!.useItem(Fight.self)
	if(getAbsoluteShield(Fight.self.id)<=0) Items.getItem(CHIP_SHIELD)!.useItem(Fight.self)
	if(getAbsoluteShield(Fight.self.id)<=0) Items.getItem(CHIP_HELMET)!.useItem(Fight.self)
	if(getRelativeShield(Fight.self.id)<=0) Items.getItem(CHIP_WALL)!.useItem(Fight.self)
	if(Fight.self.life<Fight.self.totalLife){
		Items.getItem(CHIP_CURE)!.useItem(Fight.self)
	}
	Items.getItem(CHIP_ARMORING)!.useItem(Fight.self)
	Items.getItem(CHIP_VACCINE)!.useItem(Fight.self)
	Items.getItem(CHIP_PROTEIN)!.useItem(Fight.self)
	var tpused = tpleft-getTP()
	if(tpused>0) debugE('/!\ turn '+getTurn()+" failSafe TP used: "+tpused)
}
failSafe()

Benchmark.display()


