class Damages{
	/*
	 * TODO gestion des consequences
	 * Pour chaque ennemis vivants somme les dommages de leurs items en fonction des TP et des temps de récupérations
	 * @param cell Cellule sur laquelle le danger va être calculé
	 * @param consequences Consequences qui contient les altérations de la série d'action précédente dans le combo
	 * @return un objet <Danger>
	 */
	static Danger computeDanger(Cell cell, Consequences? consequences){
		real dmg = 0.0
		string str = ""
		for(Entity e in Fight.getEnemiesAlive()){ // TODO boucle sur ordered all
			if(consequences && consequences!.isKilled(e)) continue
			integer tpleft = e.getCurrentTP(consequences)
			for(Item item in e.offensiveItems){
				real ratioDmg = MapDanger._map_entity_item_danger[e]![item]![cell]!
				real tmpdmg = Damages.getDamage(e, Fight.self, item, ratioDmg, consequences)
				if(tmpdmg>0){
					while(item.cost<=tpleft){
						str+=" "+item.name
						dmg+=tmpdmg
						tpleft-=item.cost
						if(item.haveCD) break
					}
				}
			}
		}
		return Danger(cell, dmg, str, consequences)
	}
		
	/*
	 * Calcule les dommages que peux faire eSource sur eTarget avec une Item en fonction des effets de celle-ci
	 * @param eSource attaquant
	 * @param eTarget receveur
	 * @param item Item
	 * @return dmg Dommages calculés
	 */
	static real getDamage(Entity eSource, Entity eTarget, Item item, real ratioDmg, Consequences? conseq){
		real dmg = 0.0;
		for(ItemEffect e in item.effects){
			if(e.type == EFFECT_DAMAGE){
				real tmp = e.avgmax *(1+(eSource.getCurrentStr(conseq))/100) *(1+(eSource.pwr/100));
				tmp = tmp *ratioDmg *(1-(eTarget.getCurrentRel(conseq))/100) - (eTarget.getCurrentAbs(conseq))
				dmg+= tmp>0?tmp:0
			}
			else if(e.type == EFFECT_POISON){
				real duration = Scoring.defensive_duration_mitigation[e.duration]!
				// TODO if(_CAN_ANTIDOTE) duration = 1;
				// TODO add consequences for pwr !
				dmg += e.avgmax *(1+(eSource.getCurrentMgc(conseq))/100) *(1+(eSource.pwr/100)) *ratioDmg*duration
			}
		}
		return dmg
	}
}