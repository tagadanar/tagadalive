class MapAction {
	static Map<Item, Map<Cell, Array<Action>>> _item_cell_actions // [item:[cell:[actions]]]
	static Map<Cell, Map<Item, Array<Action>>> _cell_item_actions // [cell:[item:[actions]]]
	static Map<Cell, Map<Item, Action>> _cell_item_bestAction // [cell:[item:action]]
	
	static void refresh() {
		// remise à zéro des maps
		_item_cell_actions = [:]
		_cell_item_actions = [:]
		_cell_item_bestAction = [:]
		// pour chaque item
		for(Item item in Fight.self.items){
			// si j'ai le cooldown
			if(getCooldown(item.id, Fight.self.id) > 0) continue
			// selon l'area de l'item
			if(item.area == AREA_POINT){
				// pour chaque cible valide de l'item
				for(Entity entity in item.targetSet()){
					if(entity==Fight.self){
						// si c'est moi la cible, je peux le lancer sur moi même que si la minrange le permet
						if(item.minRange == 0){
							MapAction.addAction(item, Fight.selfCell, Fight.selfCell)
						}
					} else {
						// sinon je liste toutes les cases depuis lesquelles je peux tirer sur la cible
						Array<Cell> cells = Targets.getCellsToUseItemOnCell(item, entity.cell, [Fight.self.id])
						for(Cell c in cells) MapAction.addAction(item, c, entity.cell)
					}
				}
			}else if(item.area == AREA_LASER_LINE){
				for(Entity entity in item.targetSet()){
					if(entity==Fight.self) continue; // on peut jamais se tirer dessus au lazer
					Array<Cell> cellsFrom = Targets.getLazerCellsToUseItemOnCell(item, entity.cell)
					for(Cell cell in cellsFrom){
						MapAction.addAction(item, cell, entity.cell)
					}
				}
				// maybe here I should handle AREA_FIRST_INLINE ? 
			}else{ // every aoe
				for(Entity entity in item.targetSet()){
					if(entity==Fight.self) continue
					// TODO réfléchir à l'implem de ce genre de move sur case vide..
					// si c'est moi la cible, si la minrange le permet, visez les cells proche ?
					// if(entity==Fight.self && item.minRange <= ?){}
					for(Cell cell in entity.cell.getAreaCells(item.area)){
						Array<Cell> cells = Targets.getCellsToUseItemOnCell(item, cell, [Fight.self.id])
						for(Cell c in cells) MapAction.addAction(item, c, cell)
					}
				}
			}
		}
	}
	
	static Map<Cell, Map<Item, Action>> getMapBestAction(){
		return _cell_item_bestAction
	}
	
	static void addAction(Item item, Cell from, Cell targetCell){
		if(targetCell != Fight.selfCell && 
		   (Fight.self.reachableCells[from]==null || Fight.self.reachableCells[from] > Fight.self.mp)) return;
		Benchmark.start("addAction")
		Action action = new Action(item, from, targetCell)
		
		// ajout dans la map par item puis cells
		if(!_item_cell_actions[item]) _item_cell_actions[item] = [:]
		if(!_item_cell_actions[item]![from]) _item_cell_actions[item]![from] = []
		push(_item_cell_actions[item]![from]!, action)
		
		// ajout dans la map par cell puis items
		if(!_cell_item_actions[from]) _cell_item_actions[from] = [:]
		if(!_cell_item_actions[from]![item]) _cell_item_actions[from]![item] = []
		push(_cell_item_actions[from]![item]!, action)
		
		// ici, je ne set sur chaque case, pour chaque item, que la meilleure action et pas les autres:
		// => réduction forte de la complexité
		// => pas de perte normalement si j'ai déjà check avant les effets qui change drastiquement le scoring, genre kill un leek
		// limitation > changement drastique de score après certain effet, genre libération.
		// maybe solution > implem un préscoring envisageant l'action précédente de debuff, doit pas y en avoir 40
		if(!_cell_item_bestAction[from]) _cell_item_bestAction[from] = [:]
		if(!_cell_item_bestAction[from]![item]) _cell_item_bestAction[from]![item] = action
		else if(_cell_item_bestAction[from]![item]!.score < action.score) _cell_item_bestAction[from]![item] = action
		Benchmark.stop("addAction")
	}
}